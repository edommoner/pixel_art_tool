import Cropper from "cropperjs";
import { els } from "./ui/elements.js";

export function reinitCropper(state) {
  try {
    if (state.cropper) state.cropper.destroy();
    state.cropper = new Cropper(els.preview, {
      viewMode: 1,
      aspectRatio: 1,
      autoCropArea: 1,
      responsive: false,
      dragMode: "move",
      cropBoxMovable: false,
      cropBoxResizable: false,
      background: true,
    });
  } catch (_) {}
}
