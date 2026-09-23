"""seed reference data

Revision ID: d5a0802725d9
Revises: 450df622c34b
Create Date: 2026-09-23 12:25:06.936989

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5a0802725d9"
down_revision: str | Sequence[str] | None = "450df622c34b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        INSERT INTO cities (name, slug) VALUES ('Москва', 'moscow')
        ON CONFLICT (slug) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO categories (code, name, slug) VALUES
            ('CONCERT', 'Концерты', 'concert'),
            ('THEATRE', 'Театр', 'theatre'),
            ('STANDUP', 'Стендап', 'standup'),
            ('FESTIVAL', 'Фестивали', 'festival')
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        DELETE FROM categories
        WHERE code IN ('CONCERT', 'THEATRE', 'STANDUP', 'FESTIVAL')
        """
    )
    op.execute("DELETE FROM cities WHERE slug = 'moscow'")
