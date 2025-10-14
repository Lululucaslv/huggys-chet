import { useGateStore } from "../../lib/useAuthGate";
import { AuthForm } from "./AuthForm";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle
} from "../ui/sheet";

export function RegisterDrawer() {
  const drawerOpen = useGateStore((s)=> s.drawerOpen);
  const setOpen = useGateStore((s)=> s.setOpen);
  const intent = useGateStore((s)=> s.intent);
  const authMode = useGateStore((s)=> s.authMode);

  function handleSuccess(){
    const payload = (intent as any)?.payload;
    setOpen(false);
    if (payload?.onAllow && typeof payload.onAllow === "function") {
      payload.onAllow();
    }
  }

  const title = authMode === "signin" ? "Sign in to your account" : "Create your account";
  const description = authMode === "signin" 
    ? "Welcome back! Sign in to continue." 
    : "Sign up to save bookings and assessments.";

  return (
    <Sheet open={drawerOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[480px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <AuthForm mode={authMode} onSuccess={handleSuccess} />
      </SheetContent>
    </Sheet>
  );
}
