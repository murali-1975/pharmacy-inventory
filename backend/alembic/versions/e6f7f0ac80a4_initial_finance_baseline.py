"""Initial Finance Baseline

Revision ID: e6f7f0ac80a4
Revises: 
Create Date: 2026-04-25 12:36:47.189314

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = 'e6f7f0ac80a4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with idempotency checks."""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # 1. Table: daily_finance_summary
    if 'daily_finance_summary' not in tables:
        op.create_table('daily_finance_summary',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('summary_date', sa.Date(), nullable=False),
            sa.Column('patient_count', sa.Integer(), nullable=True),
            sa.Column('total_revenue', sa.Float(), nullable=True),
            sa.Column('total_collected', sa.Float(), nullable=True),
            sa.Column('total_gst', sa.Float(), nullable=True),
            sa.Column('service_breakdown', sa.JSON(), nullable=True),
            sa.Column('payment_breakdown', sa.JSON(), nullable=True),
            sa.Column('last_updated', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_daily_finance_summary_id'), 'daily_finance_summary', ['id'], unique=False)
        op.create_index(op.f('ix_daily_finance_summary_summary_date'), 'daily_finance_summary', ['summary_date'], unique=True)

    # 2. Table: patient_payment
    if 'patient_payment' not in tables:
        op.create_table('patient_payment',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('patient_name', sa.String(), nullable=False),
            sa.Column('payment_date', sa.Date(), nullable=False),
            sa.Column('total_amount', sa.Float(), nullable=False),
            sa.Column('gst_amount', sa.Float(), nullable=True),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('free_flag', sa.Boolean(), nullable=False),
            sa.Column('token_no', sa.Integer(), nullable=True),
            sa.Column('payment_status', sa.String(), nullable=False, server_default='PAID'),
            sa.Column('created_by', sa.Integer(), nullable=False),
            sa.Column('created_date', sa.DateTime(), nullable=False),
            sa.Column('modified_by', sa.Integer(), nullable=False),
            sa.Column('modified_date', sa.DateTime(), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('deleted_by', sa.Integer(), nullable=True),
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['modified_by'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_patient_payment_id'), 'patient_payment', ['id'], unique=False)
        op.create_index(op.f('ix_patient_payment_is_deleted'), 'patient_payment', ['is_deleted'], unique=False)
    else:
        # Table exists (bridge from production), check for missing columns
        columns = [c['name'] for c in inspector.get_columns('patient_payment')]
        if 'payment_status' not in columns:
            op.add_column('patient_payment', sa.Column('payment_status', sa.String(), nullable=False, server_default='PAID'))
        if 'is_deleted' not in columns:
            op.add_column('patient_payment', sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default='false'))
        if 'deleted_by' not in columns:
            op.add_column('patient_payment', sa.Column('deleted_by', sa.Integer(), nullable=True))
            op.create_foreign_key('patient_payment_deleted_by_fkey', 'patient_payment', 'users', ['deleted_by'], ['id'])
        if 'deleted_at' not in columns:
            op.add_column('patient_payment', sa.Column('deleted_at', sa.DateTime(), nullable=True))
        
        # Check for index
        indexes = [i['name'] for i in inspector.get_indexes('patient_payment')]
        if 'ix_patient_payment_is_deleted' not in indexes:
            op.create_index(op.f('ix_patient_payment_is_deleted'), 'patient_payment', ['is_deleted'], unique=False)

    # 3. Junction Tables
    if 'ptnt_pmnt_value' not in tables:
        op.create_table('ptnt_pmnt_value',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('patient_payment_id', sa.Integer(), nullable=False),
            sa.Column('payment_mode_id', sa.Integer(), nullable=False),
            sa.Column('value', sa.Float(), nullable=False),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('modified_by', sa.Integer(), nullable=False),
            sa.Column('modified_date', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['modified_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['patient_payment_id'], ['patient_payment.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['payment_mode_id'], ['payment_mode.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_ptnt_pmnt_value_id'), 'ptnt_pmnt_value', ['id'], unique=False)

    if 'ptnt_pmnt_x_ptnt_srvcs' not in tables:
        op.create_table('ptnt_pmnt_x_ptnt_srvcs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('patient_payment_id', sa.Integer(), nullable=False),
            sa.Column('service_id', sa.Integer(), nullable=False),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.ForeignKeyConstraint(['patient_payment_id'], ['patient_payment.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['service_id'], ['patient_services.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_ptnt_pmnt_x_ptnt_srvcs_id'), 'ptnt_pmnt_x_ptnt_srvcs', ['id'], unique=False)

    if 'ptnt_pymnt_x_ptnt_id' not in tables:
        op.create_table('ptnt_pymnt_x_ptnt_id',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('patient_payment_id', sa.Integer(), nullable=False),
            sa.Column('identifier_id', sa.Integer(), nullable=False),
            sa.Column('id_value', sa.String(), nullable=False),
            sa.ForeignKeyConstraint(['identifier_id'], ['patient_identifier.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['patient_payment_id'], ['patient_payment.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_ptnt_pymnt_x_ptnt_id_id'), 'ptnt_pymnt_x_ptnt_id', ['id'], unique=False)

    # 4. Inventory Table Corrections
    op.alter_column('invoice_line_items', 'mrp',
               existing_type=sa.DOUBLE_PRECISION(precision=53),
               comment=None,
               existing_comment='Maximum Retail Price',
               existing_nullable=True)
    # Check for FKs before adding to avoid "already exists" errors in some PG versions
    existing_fks = [f['name'] for f in inspector.get_foreign_keys('invoice_line_items')]
    if not any('created_by' in fk for fk in existing_fks):
        op.create_foreign_key(None, 'invoice_line_items', 'users', ['created_by'], ['id'])
    if not any('modified_by' in fk for fk in existing_fks):
        op.create_foreign_key(None, 'invoice_line_items', 'users', ['modified_by'], ['id'])

    # Fix type anomaly for modified_by (it was incorrectly set as DATE in some versions)
    columns_payments = [c['name'] for c in inspector.get_columns('invoice_payments')]
    current_type = next((c['type'] for c in inspector.get_columns('invoice_payments') if c['name'] == 'modified_by'), None)
    
    if 'modified_by' in columns_payments and str(current_type) == 'DATE':
        op.drop_column('invoice_payments', 'modified_by')
        op.add_column('invoice_payments', sa.Column('modified_by', sa.Integer(), nullable=True))

    existing_fks_payments = [f['name'] for f in inspector.get_foreign_keys('invoice_payments')]
    if not any('modified_by' in fk for fk in existing_fks_payments):
        op.create_foreign_key(None, 'invoice_payments', 'users', ['modified_by'], ['id'])
    if not any('created_by' in fk for fk in existing_fks_payments):
        op.create_foreign_key(None, 'invoice_payments', 'users', ['created_by'], ['id'])

    existing_fks_invoices = [f['name'] for f in inspector.get_foreign_keys('invoices')]
    if not any('modified_by' in fk for fk in existing_fks_invoices):
        op.create_foreign_key(None, 'invoices', 'users', ['modified_by'], ['id'])
    if not any('created_by' in fk for fk in existing_fks_invoices):
        op.create_foreign_key(None, 'invoices', 'users', ['created_by'], ['id'])


def downgrade() -> None:
    """Downgrade schema (Standard revert)."""
    op.drop_index(op.f('ix_ptnt_pymnt_x_ptnt_id_id'), table_name='ptnt_pymnt_x_ptnt_id')
    op.drop_table('ptnt_pymnt_x_ptnt_id')
    op.drop_index(op.f('ix_ptnt_pmnt_x_ptnt_srvcs_id'), table_name='ptnt_pmnt_x_ptnt_srvcs')
    op.drop_table('ptnt_pmnt_x_ptnt_srvcs')
    op.drop_index(op.f('ix_ptnt_pmnt_value_id'), table_name='ptnt_pmnt_value')
    op.drop_table('ptnt_pmnt_value')
    op.drop_index(op.f('ix_patient_payment_is_deleted'), table_name='patient_payment')
    op.drop_index(op.f('ix_patient_payment_id'), table_name='patient_payment')
    op.drop_table('patient_payment')
    op.drop_index(op.f('ix_daily_finance_summary_summary_date'), table_name='daily_finance_summary')
    op.drop_index(op.f('ix_daily_finance_summary_id'), table_name='daily_finance_summary')
    op.drop_table('daily_finance_summary')
