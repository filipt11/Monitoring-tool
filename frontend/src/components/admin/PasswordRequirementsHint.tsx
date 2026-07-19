export function PasswordRequirementsHint() {
  return (
    <p className="text-muted-foreground text-xs leading-relaxed">
      Password must be at least 12 characters long and include an uppercase
      letter, a lowercase letter, a number, and a special character from{" "}
      <span className="text-foreground/80"># ? ! @ $ % ^ & * -</span>.
    </p>
  );
}
