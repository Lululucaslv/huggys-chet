import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet'
import { useAuthGate } from '../../contexts/AuthGateContext'

export function RegisterDrawer() {
  const { registerDrawerOpen, closeRegisterDrawer } = useAuthGate()

  return (
    <Sheet open={registerDrawerOpen} onOpenChange={closeRegisterDrawer}>
      <SheetContent side="right" className="w-[480px]">
        <SheetHeader>
          <SheetTitle>只需 30 秒，开启你的个人空间</SheetTitle>
          <SheetDescription>
            注册后即可保存你的预约与测评记录
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Register drawer UI coming in Phase 4...
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
