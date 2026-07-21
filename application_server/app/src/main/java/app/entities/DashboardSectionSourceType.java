package app.entities;

/**
 * Exactly one source type is active per dashboard section.
 */
public enum DashboardSectionSourceType {
    /** Section charts metrics for an explicit list of devices. */
    DEVICE_LIST,
    /** Section charts metrics for all devices in one device group. */
    DEVICE_GROUP,
    /** Section charts metrics for an explicit list of interfaces. */
    INTERFACE_LIST,
    /** Section charts metrics for all interfaces in one interface group. */
    INTERFACE_GROUP
}
