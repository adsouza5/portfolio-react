import React from 'react';
import './Footer.css';

const Footer = () => (
  <footer id="contact" className="footer">
    <div className="footer-inner">
      <div className="footer-headline">
        <span className="footer-eyebrow">What's next?</span>
        <h2 className="footer-title">Let's build something.</h2>
        <p className="footer-sub">
          I'm currently open to new full-time opportunities.
          If you'd like to work together, reach out.
        </p>
      </div>

      <div className="footer-links">
        <a
          href="mailto:adamdsouza0078@gmail.com"
          className="footer-cta"
        >
          Say Hello ↗
        </a>
        <div className="footer-socials">
          <a href="https://www.linkedin.com/in/adam-dsouza/" target="_blank" rel="noopener noreferrer" className="footer-social">
            LinkedIn
          </a>
          <a href="https://github.com/adsouza5" target="_blank" rel="noopener noreferrer" className="footer-social">
            GitHub
          </a>
          <a href="/images/resume.jpg" target="_blank" rel="noopener noreferrer" className="footer-social">
            Resume
          </a>
        </div>
      </div>
    </div>

    <div className="footer-bottom">
      <span className="footer-copy">© 2025 Adam Dsouza</span>
      <span className="footer-built">Built with React</span>
    </div>
  </footer>
);

export default Footer;
