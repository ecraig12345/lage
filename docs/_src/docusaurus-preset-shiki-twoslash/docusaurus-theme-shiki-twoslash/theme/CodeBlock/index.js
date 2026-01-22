// Based on https://github.com/facebook/docusaurus/blob/ed9d2a26f5a7b8096804ae1b3a4fffc504f8f90d/packages/docusaurus-theme-classic/src/theme/CodeBlock/index.tsx
// which is under MIT License as per the banner

import "./styles.css"

import copy from "copy-text-to-clipboard"
import React, { useRef, useState } from "react"

const CodeBlock = ({ children, ...props }) => {
  const pre = useRef(null)
  const [showCopied, setShowCopied] = useState(false)

  const handleCopyCode = () => {
    if (pre.current) {
      copy(Array.from(pre.current.querySelectorAll("code div.line")).map(el => el.textContent).join("\n"))
    }
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2000)
  }

  return (
    <pre {...props} ref={pre}>
      {children}
      <button
        type="button"
        aria-label="Copy code to clipboard"
        className="copy-button"
        onClick={handleCopyCode}
      >
        {showCopied ? 'Copied' : 'Copy'}
      </button>
    </pre>
  )
}

export default CodeBlock
