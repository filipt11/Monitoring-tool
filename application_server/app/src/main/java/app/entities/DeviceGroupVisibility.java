package app.entities;

public enum DeviceGroupVisibility {
    /** Visible to all users; editable only by admins. */
    PUBLIC,
    /** Visible and editable only by admins. */
    ADMIN_ONLY,
    /** Visible and editable by the owner and admins. */
    PRIVATE
}
