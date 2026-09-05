import type { ComponentProps, ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../utils/cn';

/** Design-system tabs on Radix Tabs (arrow-key navigation, ARIA tabs semantics). */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ children, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List className="ds-tabs-list" {...props}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger className="ds-tab" value={value}>
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Content className={cn('ds-tabs-content', className)} value={value}>
      {children}
    </TabsPrimitive.Content>
  );
}
