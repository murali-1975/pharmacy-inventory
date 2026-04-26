"""add expense columns to daily finance summary

Revision ID: eb0c85c6f6c4
Revises: e796b8c9a998
Create Date: 2026-04-26 11:22:06.910541

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eb0c85c6f6c4'
down_revision: Union[str, Sequence[str], None] = 'e796b8c9a998'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('daily_finance_summary', sa.Column('total_expenses', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column('daily_finance_summary', sa.Column('total_expense_gst', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column('daily_finance_summary', sa.Column('expense_breakdown', sa.JSON(), nullable=True, server_default='{}'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('daily_finance_summary', 'expense_breakdown')
    op.drop_column('daily_finance_summary', 'total_expense_gst')
    op.drop_column('daily_finance_summary', 'total_expenses')
