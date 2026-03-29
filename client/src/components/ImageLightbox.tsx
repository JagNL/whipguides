/**
 * ImageLightbox — click any image to view full-screen with prev/next navigation.
 * Zero dependencies beyond React. Pure CSS transitions, GPU-composited.
 */
import { useEffect, useCallback, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

export function ImageLightbox({ images, startIndex = 0, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [entering, setEntering] = useState(true);

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 10);
    return () => clearTimeout(t);
  }, []);

  const prev = useCallback(() => {
    setZoomed(false);
    setCurrent(i => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setZoomed(false);
    setCurrent(i => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = images[current];
    a.download = `image-${current + 1}.jpg`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.95)",
        opacity: entering ? 0 : 1,
        transition: "opacity 0.2s ease",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
        <span className="text-white/70 text-sm font-medium">
          {current + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Prev button */}
      {images.length > 1 && (
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition-all hover:scale-110 active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Main image */}
      <div
        className="relative flex items-center justify-center w-full h-full px-16 py-16"
        onClick={() => setZoomed(z => !z)}
      >
        <img
          key={current}
          src={images[current]}
          alt={`Image ${current + 1}`}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            cursor: zoomed ? "zoom-out" : "zoom-in",
            transform: zoomed ? "scale(1.8)" : "scale(1)",
            transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
            animation: "lightbox-img-in 0.25s cubic-bezier(0.34, 1.2, 0.64, 1) both",
          }}
          draggable={false}
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white transition-all hover:scale-110 active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Thumbnail strip (for multiple images) */}
      {images.length > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-4 py-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
          onClick={e => e.stopPropagation()}
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => { setZoomed(false); setCurrent(i); }}
              className="relative shrink-0 rounded-md overflow-hidden transition-all"
              style={{
                width: i === current ? 56 : 44,
                height: i === current ? 56 : 44,
                opacity: i === current ? 1 : 0.55,
                outline: i === current ? "2px solid rgb(249 115 22)" : "none",
                outlineOffset: 2,
                transition: "all 0.2s ease",
              }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes lightbox-img-in {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * useImageLightbox — hook to manage lightbox state.
 * Returns open(images, index) to trigger the lightbox, and a render element.
 */
export function useImageLightbox() {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null);

  const open = useCallback((images: string[], index = 0) => {
    setState({ images, index });
  }, []);

  const close = useCallback(() => setState(null), []);

  const lightbox = state ? (
    <ImageLightbox images={state.images} startIndex={state.index} onClose={close} />
  ) : null;

  return { open, lightbox };
}

/**
 * PostImageGrid — drop-in replacement for image grids in posts.
 * Shows up to 4 images in a responsive grid; click any to open lightbox.
 */
export function PostImageGrid({ images }: { images: string[] }) {
  const { open, lightbox } = useImageLightbox();

  if (!images?.length) return null;

  return (
    <>
      <div className={`grid gap-1.5 mt-3 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {images.slice(0, 4).map((img, i) => (
          <div
            key={i}
            className="relative rounded-lg overflow-hidden aspect-video bg-secondary cursor-pointer group"
            onClick={() => open(images, i)}
          >
            <img
              src={img}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 rounded-full p-2">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
            {/* +N overflow badge */}
            {i === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <span className="text-xl font-bold">+{images.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {lightbox}
    </>
  );
}
