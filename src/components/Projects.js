import React, { useRef, useLayoutEffect, useEffect, useState } from "react";
import projects from "./ProjectsData";
import "./Projects.css";
import image from "./images/etherea1.png"

const Projects = () => {
  const projectRefs = useRef([]);
  const [markerPositions, setMarkerPositions] = useState([]);
  const [flippedCards, setFlippedCards] = useState({});
  const [cardHeights, setCardHeights] = useState({});
  const [originalHeights, setOriginalHeights] = useState({});
  const prevPositionsRef = useRef([]);

  // On initial mount, measure each card’s original height.
  useLayoutEffect(() => {
    const heights = {};
    projectRefs.current.forEach((card, index) => {
      if (card) {
        heights[index] = card.clientHeight;
      }
    });
    setOriginalHeights(heights);
    setCardHeights(heights);
  }, []);

  const handleCardClick = (index) => {
    // Capture current vertical positions before state change.
    prevPositionsRef.current = projectRefs.current.map(
      (el) => (el ? el.getBoundingClientRect().top : 0)
    );
    setFlippedCards((prev) => {
      const newFlipped = !prev[index];
      // When unflipping, revert to the original measured height.
      if (!newFlipped) {
        setCardHeights((prevHeights) => ({
          ...prevHeights,
          [index]: originalHeights[index],
        }));
      }
      return { ...prev, [index]: newFlipped };
    });
  };

  // Animate repositioning after a flip using FLIP.
  useLayoutEffect(() => {
    projectRefs.current.forEach((el, index) => {
      if (!el) return;
      const prev = prevPositionsRef.current[index] || 0;
      const newPos = el.getBoundingClientRect().top;
      const delta = prev - newPos;
      if (delta !== 0) {
        el.style.transition = "transform 0s";
        el.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 1s ease";
          el.style.transform = "";
        });
      }
    });
  }, [flippedCards, cardHeights]);

  // Update timeline marker positions.
  useEffect(() => {
    const positions = projectRefs.current.map((ref) => ref?.offsetTop || 0);
    setMarkerPositions(positions);
  }, [flippedCards, cardHeights]);

  // When the image on the flipped side loads, measure its height and update the card.
  const handleImageLoad = (index, e) => {
    const imgHeight = e.target.clientHeight;
    // Add extra space for the card’s padding (assumed 60px top and 60px bottom = 120px).
    const newHeight = imgHeight + 120;
    setCardHeights((prev) => ({ ...prev, [index]: newHeight }));
  };

  return (
    <section id="projects" className="projects-section">
      {/* Timeline (Left Side) */}
      <div className="timeline">
        <div className="timeline-line"></div>
        {projects.map((project, index) => (
          <div
            key={index}
            className="timeline-entry"
            style={{ top: `${(markerPositions[index] || 0) + 20}px` }}
          >
            <div className="timeline-marker"></div>
            <div className="timeline-label">{project.timestamp}</div>
          </div>
        ))}
      </div>

      {/* Projects Content */}
      <div className="projects-content">
        <h1 className="h1-text">Projects Timeline</h1>
        {projects.map((project, index) => {
          const isFlipped = !!flippedCards[index];
          const cardStyle = {
            height: cardHeights[index] ? `${cardHeights[index]}px` : "auto",
          };

          return (
            <div
              key={index}
              className="project-card"
              ref={(el) => (projectRefs.current[index] = el)}
              style={cardStyle}
              onClick={() => handleCardClick(index)}
            >
              <div className={`flip-inner ${isFlipped ? "flipped" : ""}`}>
                <div className="flip-front">
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                </div>
                <div className="flip-back">
                  {/* Add an image to the flipped side */}
                  <img
                    src={image}
                    alt={project.title}
                    onLoad={(e) => handleImageLoad(index, e)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Projects;
