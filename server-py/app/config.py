"""환경변수. 이름은 Node 서버와 같게 두어 .env 를 그대로 공유한다."""
import os


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"환경변수 {name} 이 없습니다.")
    return value


def optional(name: str, fallback: str) -> str:
    return os.environ.get(name) or fallback


class Config:
    @property
    def port(self) -> int:
        return int(optional("PY_PORT", "4320"))

    # app   : RLS 가 적용되는 역할. 사용자 요청 처리용.
    # admin : RLS 를 우회하는 역할. 서버 내부 작업용.
    @property
    def db_app_url(self) -> str:
        return optional("DATABASE_URL_APP", "postgres://farmassi_app@localhost:5432/farmassi")

    @property
    def db_admin_url(self) -> str:
        return optional("DATABASE_URL_ADMIN", "postgres://farmassi_admin@localhost:5432/farmassi")

    @property
    def jwt_secret(self) -> str:
        return required("JWT_SECRET")

    @property
    def session_days(self) -> int:
        return int(optional("SESSION_DAYS", "30"))

    @property
    def site_origins(self) -> list[str]:
        """쉼표로 여러 개. 첫 번째가 대표 주소로, 돌아갈 곳을 못 정했을 때 쓰인다."""
        raw = optional("SITE_ORIGIN", "https://shop.lkim.me")
        return [v.strip().rstrip("/") for v in raw.split(",") if v.strip()]

    @property
    def site_origin(self) -> str:
        return self.site_origins[0]

    @property
    def upload_dir(self) -> str:
        return optional("UPLOAD_DIR", "/opt/homebrew/var/www/shop-uploads")

    @property
    def public_upload_base(self) -> str:
        return optional("PUBLIC_UPLOAD_BASE", "https://api.shop.lkim.me/files")


config = Config()
