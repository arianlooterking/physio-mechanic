import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Small inline message instead of the full-page fallback. */
  inline?: boolean;
}

interface State {
  error: Error | null;
}

/** Keeps one broken part (for example an interactive lab) from taking the whole app down. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('بیومانا:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.inline) {
      return (
        <div className="note warn" role="alert">
          <div>
            <span className="n-title">این بخش باز نشد</span>
            بقیهٔ درس کار می‌کند. اگر تکرار شد، صفحه را دوباره باز کن.
          </div>
        </div>
      );
    }
    return (
      <div className="onb" role="alert">
        <div className="onb-body center">
          <h1>یک مشکل پیش آمد</h1>
          <p className="lead">پیشرفتت ذخیره شده است. صفحه را دوباره باز کن.</p>
          <button className="btn lg" onClick={() => location.reload()}>
            بارگذاری دوباره
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              location.hash = '#/';
              location.reload();
            }}
          >
            بازگشت به خانه
          </button>
        </div>
      </div>
    );
  }
}
