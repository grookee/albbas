export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
};

type ConfirmSpec = {
  title: string;
  message: string;
  confirmLabel: string;
};

export const confirmState = $state<{ current: ConfirmSpec | null }>({ current: null });

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
    };
  });
}

export function settleConfirm(value: boolean): void {
  confirmState.current = null;
  const resolve = resolveFn;
  resolveFn = null;
  resolve?.(value);
}
