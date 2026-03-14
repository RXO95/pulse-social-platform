import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

// Utility to create a canvas to extract the cropped image
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // set each dimensions to double largest dimension to allow for a safe area for the
  // image to rotate in without being clipped by canvas context
  canvas.width = safeArea;
  canvas.height = safeArea;

  // translate canvas context to a central location on image to allow rotating around the center.
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // draw rotated image and store data.
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // paste generated rotate image with correct offsets for x,y crop values.
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  // As a blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, "image/jpeg", 0.9);
  });
}

export default function ImageCropperPopup({
  imageSrc,
  onCropComplete,
  onCancel,
  theme,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropCompleteInternal = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error(e);
      onCancel();
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, backgroundColor: theme.bg, borderColor: theme.border }}>
        <h3 style={{ ...styles.title, color: theme.text }}>Crop Profile Picture</h3>
        <div style={styles.cropContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={setZoom}
          />
        </div>
        <div style={styles.controls}>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => {
              setZoom(e.target.value);
            }}
            style={styles.slider}
          />
        </div>
        <div style={styles.actions}>
          <button style={{ ...styles.btn, ...styles.cancelBtn, color: theme.text }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ ...styles.btn, ...styles.saveBtn }} onClick={handleSave}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  modal: {
    width: "400px",
    maxWidth: "90%",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid",
  },
  title: {
    margin: 0,
    padding: "16px",
    fontSize: "18px",
    fontWeight: "600",
    textAlign: "center",
  },
  cropContainer: {
    position: "relative",
    width: "100%",
    height: "300px",
    backgroundColor: "#000",
  },
  controls: {
    padding: "16px",
    display: "flex",
    justifyContent: "center",
  },
  slider: {
    width: "80%",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "16px",
    gap: "12px",
    borderTop: "1px solid rgba(128,128,128,0.2)",
  },
  btn: {
    padding: "8px 16px",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    border: "none",
  },
  cancelBtn: {
    backgroundColor: "transparent",
  },
  saveBtn: {
    backgroundColor: "#1d9bf0",
    color: "#fff",
  },
};
