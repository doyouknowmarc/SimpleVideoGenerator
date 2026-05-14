"use client";

type Props = { onClick: () => void };

export function AddMediaButton({ onClick }: Props) {
  return (
    <button className="add-media-btn" onClick={onClick}>
      <span className="plus">+</span> Add Media
    </button>
  );
}
