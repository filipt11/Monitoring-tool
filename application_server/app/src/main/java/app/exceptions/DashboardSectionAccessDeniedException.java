package app.exceptions;

public class DashboardSectionAccessDeniedException extends RuntimeException {
    public DashboardSectionAccessDeniedException() {
        super("You do not have permission to modify this dashboard section");
    }
}
