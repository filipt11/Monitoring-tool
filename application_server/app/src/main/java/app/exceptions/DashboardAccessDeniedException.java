package app.exceptions;

public class DashboardAccessDeniedException extends RuntimeException {
    public DashboardAccessDeniedException() {
        super("You do not have permission to modify this dashboard");
    }
}
