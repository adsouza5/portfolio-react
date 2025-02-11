// Home.js
import React from "react";
import "./Home.css";

const addKeyframesRule = (rule) => {
  // Ensure there is a stylesheet to add our rule to.
  let styleSheet;
  if (document.styleSheets.length > 0) {
    styleSheet = document.styleSheets[0];
  } else {
    const styleEl = document.createElement("style");
    document.head.appendChild(styleEl);
    styleSheet = styleEl.sheet;
  }
  try {
    styleSheet.insertRule(rule, styleSheet.cssRules.length);
  } catch (e) {
    console.error("Error inserting keyframes rule:", e);
  }
};

const Fireflies = () => {
  const numFireflies = 15; // Adjust the number as desired

  // Generate firefly data with random properties.
  const fireflyData = Array.from({ length: numFireflies }).map((_, index) => {
    // Random starting position (percentage values ensure they’re within the container)
    const top = Math.random() * 100;
    const left = Math.random() * 100;

    // Create random offsets for intermediate keyframe stops (in pixels)
    const randomOffset = () => `${Math.floor(Math.random() * 100 - 50)}px`; // Range: -50px to 50px
    const offset1x = randomOffset();
    const offset1y = randomOffset();
    const offset2x = randomOffset();
    const offset2y = randomOffset();

    // Create a unique animation name for the wander motion
    const animationName = `fly_${index}_${Date.now()}`;

    // Generate keyframes that make the firefly wander from its starting position
    const keyframes = `
      @keyframes ${animationName} {
        0% { transform: translate(0, 0); }
        33% { transform: translate(${offset1x}, ${offset1y}); }
        66% { transform: translate(${offset2x}, ${offset2y}); }
        100% { transform: translate(0, 0); }
      }
    `;
    addKeyframesRule(keyframes);

    // Randomize wander animation duration (e.g., between 5 and 10 seconds) and delay (0 to 4 seconds)
    const duration = 5 + Math.random() * 7;
    const delay = Math.random() * 4;

    // Randomize blink delay
    const blinkDelay = Math.random() * 2; // Up to 2 seconds delay

    // Firefly color: keep the same values as before
    const color = Math.random() < 0.5 ? "#FFD700" : "#FFE560";

    return {
      animationName,
      top: `${top}%`,
      left: `${left}%`,
      duration,
      delay,
      blinkDelay,
      color,
    };
  });

  return (
    <>
      {fireflyData.map((firefly, index) => (
        <div 
          key={index}
          className="firefly"
          style={{
            top: firefly.top,
            left: firefly.left,
            backgroundColor: firefly.color,
            /* Combine three animations:
               1. fadeIn: One-time fade in over 1s.
               2. blink: 2s continuous blink with a random delay.
               3. wander: Random movement animation.
            */
            animation: `
              fadeIn 1s ease forwards, 
              blink 6s ease-in-out ${firefly.blinkDelay}s infinite, 
              ${firefly.animationName} ${firefly.duration}s ${firefly.delay}s ease-in-out infinite
            `
          }}
        />
      ))}
    </>
  );
};

const Home = () => {
  return (
    <section
      id="home"
      className="section visible flex flex-col items-center justify-start pt-10 text-white"
    >
      <h3 className="h3-text">
        <i>
          Code is the canvas, curiosity the brush — innovation is what you create when you dare to wonder.
        </i>
      </h3>
      <div className="image-container relative">
        <img
          src="/images/portfolio.jpg"
          alt="Portfolio Photo"
          className="portfolio-img"
        />
        <div className="social-icons">
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/images/linkedIn.png"
              alt="LinkedIn"
              className="social-icon"
            />
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/images/github.png"
              alt="GitHub"
              className="social-icon"
            />
          </a>
        </div>
      </div>
      <h1 className="h1-text">Adam Dsouza</h1>
      <h2 className="h2-text">Learn. Create. Innovate.</h2>
      {/* Render the fireflies */}
      <Fireflies />
    </section>
  );
};

export default Home;
