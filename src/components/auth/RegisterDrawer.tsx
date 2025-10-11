import { useGateStore } from "../../lib/useAuthGate";
import { AuthForm } from "./AuthForm";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle
} from "../ui/sheet";

export function RegisterDrawer() {
  const drawerOpen = useGateStore((s)=> s.drawerOpen);
  const setOpen = useGateStore((s)=> s.setOpen);
  const intent = useGateStore((s)=> s.intent);

  function handleSuccess(){
    const payload = (intent as any)?.payload;
    setOpen(false);
    if (payload?.onAllow && typeof payload.onAllow === "function") {
      payload.onAllow();
    }
  }

  return (
    <Sheet open={drawerOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[480px]">
        <SheetHeader>
          <SheetTitle>Create your account</SheetTitle>
          <SheetDescription>Sign up to save bookings and assessments.</SheetDescription>
        </SheetHeader>

        <AuthForm onSuccess={handleSuccess} />
      </SheetContent>
    </Sheet>
  );
}
