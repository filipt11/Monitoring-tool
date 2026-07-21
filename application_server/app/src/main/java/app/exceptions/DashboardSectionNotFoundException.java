package app.exceptions;

public class DashboardSectionNotFoundException extends RuntimeException {
    public DashboardSectionNotFoundException() {
        super("Dashboard section not found");
    }
}
