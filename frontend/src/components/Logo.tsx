export function Logo() {
  return (
    <div className="flex items-center">
      <a
        href="https://mier.info"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center"
      >
        <img
          src="https://mier.info/assets/favicon.svg"
          alt="mier.info"
          width="20"
          height="20"
        />
      </a>
      <svg
        width="52"
        height="20"
        viewBox="0 0 52 20"
        xmlns="http://www.w3.org/2000/svg"
        className="logo"
      >
        <text
          x="26"
          y="15"
          fontFamily="monospace"
          fontSize="18"
          fontWeight="700"
          fill="currentColor"
          textAnchor="middle"
        >
          vkm
        </text>
      </svg>
    </div>
  );
}
