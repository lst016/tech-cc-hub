interface ScrollToBottomButtonProps {
  onClick: () => void;
}

export function ScrollToBottomButton({ onClick }: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="有新消息，回到底部"
      title="回到底部"
      className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-[#ededed] bg-white text-[#1a1c1f] transition-colors hover:bg-[#fafafa] active:bg-[#f5f5f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
      </svg>
    </button>
  );
}
