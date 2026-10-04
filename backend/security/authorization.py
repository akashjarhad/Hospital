from typing import Dict, Any, List, Optional


class SecurityAuthorizationError(Exception):
    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


VALID_ROLES = ["DOCTOR", "PATIENT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"]


def verify_role_permission(user: Dict[str, Any], allowed_roles: List[str]) -> bool:
    """
    Strict server-side RBAC validation.
    """
    user_role = str(user.get("role", "")).upper()
    if user_role not in allowed_roles:
        raise SecurityAuthorizationError(
            f"Access Denied: Role '{user_role}' is not authorized for this operation. Allowed: {allowed_roles}",
            403
        )
    return True


def verify_hospital_affiliation(user: Dict[str, Any], target_hospital_id: int) -> bool:
    """
    Ensure user belongs to the authorized hospital facility node.
    """
    if str(user.get("role", "")).upper() == "SYSTEM_ADMIN":
        return True
    user_hosp = user.get("hospital_id")
    if user_hosp is None or int(user_hosp) != int(target_hospital_id):
        raise SecurityAuthorizationError(
            f"Access Denied: User hospital ({user_hosp}) does not match target facility ({target_hospital_id}).",
            403
        )
    return True
