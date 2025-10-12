type ToastType = "success" | "error" | "info";

export function showToast(message: string, type: ToastType = "info") {
  console.log(`[Toast ${type.toUpperCase()}]: ${message}`);
  
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Huggys.ai", { body: message });
    }
  }
  
  const event = new CustomEvent("huggys-toast", {
    detail: { message, type }
  });
  window.dispatchEvent(event);
}

export function successToast(message: string) {
  showToast(message, "success");
}

export function errorToast(message: string) {
  showToast(message, "error");
}

export function infoToast(message: string) {
  showToast(message, "info");
}
