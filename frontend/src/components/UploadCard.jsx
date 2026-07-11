import { useState, useRef } from "react";
import {
  CameraIcon,
  ImageIcon,
  SparklesIcon,
  SearchIcon,
  StarIcon,
  UtensilsIcon,
  CheckIcon,
  AlertIcon,
} from "./icons";

const stepIcons = {
  analyze: SparklesIcon,
  detect: SearchIcon,
  score: StarIcon,
  recipes: UtensilsIcon,
};

export default function UploadCard({ onUpload, isLoading, activeStep, steps, error }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onUpload(file);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
      onUpload(file);
    }
  };

  const showPipeline = isLoading || error;

  return (
    <div className="clay-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        className={`upload-dropzone ${dragging ? "is-dragging" : ""}`}
        onClick={() => galleryInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Choose an ingredient photo"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") galleryInputRef.current?.click(); }}
      >
        {preview ? (
          <img src={preview} alt="Selected ingredients" className="upload-preview" />
        ) : (
          <>
            <span className="upload-dropzone__icon">
              <CameraIcon size={30} />
            </span>
            <span>Tap to snap or drag a photo in</span>
          </>
        )}
      </div>

      <input
        type="file"
        ref={cameraInputRef}
        style={{ display: "none" }}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        onClick={(e) => { e.target.value = null; }}
      />
      <input
        type="file"
        ref={galleryInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
        onClick={(e) => { e.target.value = null; }}
      />

      {showPipeline && (
        <div className="pipeline">
          {steps.map((step, idx) => {
            const isErrorStep = error && idx === activeStep;
            const isDone = !error && idx < activeStep;
            const isActive = !error && idx === activeStep;
            const StepIcon = stepIcons[step.icon] || SparklesIcon;
            let stateClass = "";
            if (isErrorStep) stateClass = "is-error";
            else if (isDone) stateClass = "is-done";
            else if (isActive) stateClass = "is-active";
            return (
              <div key={idx} className={`pipeline-step ${stateClass}`}>
                <span className="pipeline-step__icon">
                  {isErrorStep ? <AlertIcon size={20} /> : isDone ? <CheckIcon size={20} /> : <StepIcon size={20} />}
                </span>
                <span className="pipeline-step__label">{isErrorStep ? error : step.label}</span>
                {isActive && isLoading && <span className="spinner" />}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !preview && (
        <div className="upload-actions">
          <button className="clay-btn clay-btn--primary" onClick={() => cameraInputRef.current?.click()}>
            <CameraIcon size={20} />
            Take photo
          </button>
          <button className="clay-btn clay-btn--ghost" onClick={() => galleryInputRef.current?.click()}>
            <ImageIcon size={20} />
            Gallery
          </button>
        </div>
      )}

      {!isLoading && preview && (
        <button className="clay-btn clay-btn--primary" onClick={() => galleryInputRef.current?.click()} style={{ width: "100%" }}>
          Change photo
        </button>
      )}
    </div>
  );
}
