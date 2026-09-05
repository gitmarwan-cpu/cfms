import type { ComponentProps, ReactNode } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../../utils/cn';

/** Design-system dropdown menu on Radix DropdownMenu (RTL + keyboard + roving focus). */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ children, align = 'start', ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className="ds-menu-content"
        align={align}
        sideOffset={6}
        collisionPadding={8}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

interface DropdownMenuItemProps extends ComponentProps<typeof DropdownMenuPrimitive.Item> {
  danger?: boolean;
}

export function DropdownMenuItem({ danger, className, ...props }: DropdownMenuItemProps) {
  return <DropdownMenuPrimitive.Item className={cn('ds-menu-item', danger && 'ds-menu-item--danger', className)} {...props} />;
}

export const DropdownMenuSeparator = () => <DropdownMenuPrimitive.Separator className="ds-menu-separator" />;

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenuPrimitive.Label className="ds-menu-label">{children}</DropdownMenuPrimitive.Label>;
}
