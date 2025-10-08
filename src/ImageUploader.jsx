import React from "react";

const ImageUploader = ({ onImage, imagePreview, onRemoveImage }) => {
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("仅支持上传图片文件");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert("图片太大，请上传不超过 3MB 的图片");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      onImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="ml-1 flex items-center gap-3">
      <label className="flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-cyan-300/30 bg-white/10 px-3 py-2 text-lg text-cyan-200 transition-all duration-300 hover:border-cyan-200/80 hover:shadow-[0_0_25px_rgba(56,189,248,0.35)]">
        📷
        <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </label>
      {imagePreview && (
        <div className="relative">
          <img
            src={imagePreview}
            alt="预览"
            className="h-14 w-14 cursor-pointer rounded-xl border border-cyan-100/40 object-cover shadow-[0_0_25px_rgba(56,189,248,0.3)]"
            onClick={() => window.open(imagePreview, "_blank")}
          />
          <button
            type="button"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-xs font-bold text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
            onClick={onRemoveImage}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
