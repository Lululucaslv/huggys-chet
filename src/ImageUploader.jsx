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
    <div className="flex items-center ml-1">
      <label className="cursor-pointer px-3 py-2 rounded-lg border bg-gray-100 hover:bg-blue-100">
        📷
        <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </label>
      {imagePreview && (
        <div className="relative ml-2">
          <img
            src={imagePreview}
            alt="预览"
            className="w-12 h-12 object-cover rounded-lg border cursor-pointer"
            onClick={() => window.open(imagePreview, "_blank")}
          />
          <button
            type="button"
            className="absolute top-0 right-0 bg-gray-800 rounded-full text-red-400 px-1 border border-gray-700"
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
