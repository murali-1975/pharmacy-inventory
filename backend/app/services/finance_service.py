import datetime
import io
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app import models, schemas
from app.core.logging_config import logger

class FinanceService:
    @staticmethod
    def record_payment(
        db: Session,
        payment_in: schemas.PatientPaymentCreate,
        user_id: int
    ) -> models.PatientPayment:
        """
        Atomically records a patient payment with nested identifiers and services.
        """
        # 1. Create header
        db_payment = models.PatientPayment(
            patient_name=payment_in.patient_name.strip(),
            payment_date=payment_in.payment_date,
            total_amount=payment_in.total_amount,
            gst_amount=payment_in.gst_amount,
            notes=payment_in.notes.strip() if payment_in.notes else None,
            free_flag=payment_in.free_flag,
            token_no=payment_in.token_no,
            created_by=user_id,
            modified_by=user_id,
        )
        db.add(db_payment)
        db.flush()

        # 2. Identifiers
        for ident_in in payment_in.identifiers:
            db_ident = models.PatientPaymentIdentifier(
                patient_payment_id=db_payment.id,
                identifier_id=ident_in.identifier_id,
                id_value=ident_in.id_value.strip(),
            )
            db.add(db_ident)

        # 3. Services with individual amounts
        for srv_in in payment_in.services:
            db_srv = models.PatientPaymentService(
                patient_payment_id=db_payment.id,
                service_id=srv_in.service_id,
                amount=srv_in.amount
            )
            db.add(db_srv)

        # 4. Aggregate Payments (linked directly to header)
        for pay_val_in in payment_in.payments:
            db_val = models.PatientPaymentValue(
                patient_payment_id=db_payment.id,
                payment_mode_id=pay_val_in.payment_mode_id,
                value=pay_val_in.value,
                notes=pay_val_in.notes.strip() if pay_val_in.notes else None,
                modified_by=user_id,
            )
            db.add(db_val)

        return db_payment

    @staticmethod
    def process_bulk_upload(db: Session, df: Any, user_id: int) -> Dict[str, Any]:
        """
        Processes a dataframe of payment records.
        Groups rows by (Date, Patient Name, Token No) to create a single payment header.
        """
        # Pre-fetch master data for lookup
        idents = {i.id_name.lower().strip(): i.id for i in db.query(models.PatientIdentifier).all()}
        services = {s.service_name.lower().strip(): s.id for s in db.query(models.PatientService).all()}
        modes = {m.mode.lower().strip(): m.id for m in db.query(models.PaymentModeMaster).all()}

        success_count = 0
        errors = []

        # Standardize columns
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
        
        # Grouping logic
        # We group by date, patient_name, and token_no (if exists)
        df['token_no'] = df.get('token_no', 0)
        grouped = df.groupby(['date', 'patient_name', 'token_no'])

        for (p_date, p_name, p_token), group in grouped:
            try:
                # Prepare identifiers (unique per patient-day)
                patient_idents = []
                if 'identifier_type' in group.columns and 'id_value' in group.columns:
                    for _, row in group[['identifier_type', 'id_value']].drop_duplicates().iterrows():
                        if pd.isna(row['identifier_type']) or not str(row['identifier_type']).strip():
                            continue
                        type_name = str(row['identifier_type']).lower().strip()
                        if type_name in idents:
                            patient_idents.append({
                                "identifier_id": idents[type_name],
                                "id_value": str(row['id_value'])
                            })

                # Prepare unique services and payments for this group
                patient_services_map = {}
                patient_payments_map = {}
                
                for _, row in group.iterrows():
                    # Handle Service
                    srv_name = str(row.get('service_name', '')).lower().strip()
                    if srv_name and srv_name in services:
                        srv_id = services[srv_name]
                        srv_amt = float(row.get('service_amount') if 'service_amount' in row else row.get('amount', 0))
                        if srv_id not in patient_services_map:
                            patient_services_map[srv_id] = 0
                        patient_services_map[srv_id] += srv_amt
                    elif srv_name:
                        raise ValueError(f"Service '{row.get('service_name')}' not found.")

                    # Handle Payment
                    mode_name = str(row.get('payment_mode', '')).lower().strip()
                    if mode_name and mode_name in modes:
                        m_id = modes[mode_name]
                        p_amt = float(row.get('payment_amount') if 'payment_amount' in row else row.get('amount', 0))
                        if m_id not in patient_payments_map:
                            patient_payments_map[m_id] = 0
                        patient_payments_map[m_id] += p_amt
                    elif mode_name:
                        raise ValueError(f"Payment Mode '{row.get('payment_mode')}' not found.")

                # Convert maps to list of dicts for schema
                patient_services = [{"service_id": sid, "amount": amt} for sid, amt in patient_services_map.items()]
                patient_payments = [{"payment_mode_id": mid, "value": val} for mid, val in patient_payments_map.items()]

                # Calculate totals
                # Total amount should be sum of services
                total_amount = sum(s["amount"] for s in patient_services)
                gst_amount = sum(float(row.get('gst', 0)) for _, row in group.iterrows())

                payment_in = schemas.PatientPaymentCreate(
                    patient_name=p_name,
                    payment_date=pd.to_datetime(p_date).date(),
                    total_amount=total_amount,
                    gst_amount=gst_amount,
                    token_no=int(p_token) if p_token else None,
                    identifiers=patient_idents,
                    services=patient_services,
                    payments=patient_payments
                )

                FinanceService.record_payment(db, payment_in, user_id)
                success_count += 1

            except Exception as e:
                db.rollback()
                error_info = {"date": p_date, "patient_name": p_name, "token_no": p_token, "error_reason": str(e)}
                errors.append(error_info)
                continue
        
        return {
            "success_count": success_count,
            "errors": errors
        }

    @staticmethod
    def get_dashboard_stats(db: Session) -> Dict[str, Any]:
        """
        Aggregates financial data for the dashboard.
        """
        today = datetime.date.today()
        first_day_of_month = today.replace(day=1)

        # 1. Total Income Today
        total_today = db.query(func.sum(models.PatientPayment.total_amount))\
            .filter(models.PatientPayment.payment_date == today).scalar() or 0.0

        # 2. Total Income Month
        total_month = db.query(func.sum(models.PatientPayment.total_amount))\
            .filter(models.PatientPayment.payment_date >= first_day_of_month).scalar() or 0.0

        # 3. Patient Count Today
        patient_count_today = db.query(models.PatientPayment)\
            .filter(models.PatientPayment.payment_date == today).count()

        # 4. Average Ticket Size
        avg_ticket = total_today / patient_count_today if patient_count_today > 0 else 0.0

        # 5. Service Distribution
        # We join ptnt_pmnt_x_ptnt_srvcs with patient_services
        service_data = db.query(
            models.PatientService.service_name,
            func.sum(models.PatientPaymentService.amount).label("total"),
            func.count(models.PatientPaymentService.id).label("count")
        ).join(models.PatientPaymentService)\
         .join(models.PatientPayment)\
         .filter(models.PatientPayment.payment_date >= first_day_of_month)\
         .group_by(models.PatientService.service_name).all()
        
        service_dist = [
            {"service_name": name, "total_amount": float(total), "count": count}
            for name, total, count in service_data
        ]

        # 6. Payment Mode Distribution
        mode_data = db.query(
            models.PaymentModeMaster.mode,
            func.sum(models.PatientPaymentValue.value).label("total"),
            func.count(models.PatientPaymentValue.id).label("count")
        ).join(models.PatientPaymentValue)\
         .join(models.PatientPayment)\
         .filter(models.PatientPayment.payment_date >= first_day_of_month)\
         .group_by(models.PaymentModeMaster.mode).all()
        
        mode_dist = [
            {"mode_name": name, "total_value": float(total), "count": count}
            for name, total, count in mode_data
        ]

        # 7. Recent Trends (Last 7 days)
        last_7_days = today - datetime.timedelta(days=6)
        trends_data = db.query(
            models.PatientPayment.payment_date,
            func.sum(models.PatientPayment.total_amount).label("total")
        ).filter(models.PatientPayment.payment_date >= last_7_days)\
         .group_by(models.PatientPayment.payment_date)\
         .order_by(models.PatientPayment.payment_date).all()
        
        trends = [
            {"date": d.strftime("%Y-%m-%d"), "amount": float(t)}
            for d, t in trends_data
        ]

        return {
            "total_income_today": float(total_today),
            "total_income_month": float(total_month),
            "patient_count_today": patient_count_today,
            "avg_ticket_size": float(avg_ticket),
            "service_distribution": service_dist,
            "payment_mode_distribution": mode_dist,
            "recent_trends": trends
        }
