import "./LoadingSpinner.css";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
  message?: string;
}

export default function LoadingSpinner({
  size = "md",
  fullPage = false,
  message,
}: LoadingSpinnerProps) {
  if (fullPage) {
    return (
      <div className="ls-fullpage">
        <div className={`ls-spinner ls-spinner-${size}`} />
        {message && <p className="ls-message">{message}</p>}
      </div>
    );
  }

  return (
    <div className="ls-inline">
      <div className={`ls-spinner ls-spinner-${size}`} />
      {message && <p className="ls-message">{message}</p>}
    </div>
  );
}
