# Implementation Plan: Targeted Medicine Search with Stock Visibility

This plan enhances the dispensing workflow by ensuring only available medicines are searchable and their real-time stock levels are visible right in the search dropdown.

## User Review Required

> [!IMPORTANT]
> - Medicines with **zero stock** will be hidden from the search results in the "Record Dispensing" tab to prevent errors.
> - The stock count will appear in braces next to the medicine name (e.g., `Supracal Tablet (120)`).
> - I will update the backend to ensure stock levels are included in the medicine list response, which may slightly increase the data size but will improve performance by avoiding secondary stock lookups.

## Proposed Changes

### 1. Backend Updates [MODIFY]

#### [MODIFY] [schemas.py](file:///c:/Users/DELL/OneDrive/Desktop/Projects/pharmacy-inventory/backend/app/schemas.py)
- Add `quantity_on_hand: int = 0` to `MedicineSchema`.

#### [MODIFY] [routers/medicines.py](file:///c:/Users/DELL/OneDrive/Desktop/Projects/pharmacy-inventory/backend/app/routers/medicines.py)
- Update the `list_medicines` route to eager-load the `stock` relationship using `joinedload`.
- Map the `quantity_on_hand` from the linked `MedicineStock` model to the schema field.

---

### 2. Frontend Updates [MODIFY]

#### [MODIFY] [DispensingView.jsx](file:///c:/Users/DELL/OneDrive/Desktop/Projects/pharmacy-inventory/frontend/src/views/DispensingView.jsx)
- Update `MedicineSearchSelect` component:
    - **Filtering**: Add a filter condition to only include medicines where `quantity_on_hand > 0`.
    - **Display**: Update the `displayName` and result item rendering to format as `Product Name (Stock)`.

---

## Open Questions

- Should "Out of Stock" items be completely hidden, or should they appear at the bottom with a "0 stock" label (disabled)? 
    - *Suggestion*: Completely hidden is cleaner for a dispensing flow, as you cannot dispense what you don't have. Seems good , go for this approach 

## Verification Plan

### Automated Tests
- Update `DispensingView.test.jsx` to verify that zero-stock medicines do not appear in results.
- Verify that the stock count string is rendered correctly in the dropdown.

### Manual Verification
- Log in and type "cal" in the dispensing search.
- Verify that **Supracal Tablet** (which has 0 stock) no longer appears.
- Verify that **Calcidef Tablet** shows its count (e.g. `(256)`).
