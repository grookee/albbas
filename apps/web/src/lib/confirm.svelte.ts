export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
};

type DialogSpec = {
  title: string;
  message: string;
  confirmLabel: string;
  alert: boolean;
};

export const confirmState = $state<{ current: DialogSpec | null }>({ current: null });

let resolveFn: ((value: boolean) => void) | null = null;

export function confirm(
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    resolveFn = resolve;
    confirmState.current = {
      title: options.title ?? 'are you sure?',
      message,
      confirmLabel: options.confirmLabel ?? 'confirm',
      alert: false,
    };
  });
}

export function alert(message: string, options: ConfirmOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    resolveFn = () => resolve();
    confirmState.current = {
      title: options.title ?? 'error',
      message,
      confirmLabel: options.confirmLabel ?? 'ok',
      alert: true,
    };
  });
}

export function settleConfirm(value: boolean): void {
  confirmState.current = null;
  const resolve = resolveFn;
  resolveFn = null;
  resolve?.(value);
}
