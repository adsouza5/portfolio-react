import React, { useRef, useEffect, useState } from "react";
import projects from "./ProjectsData";
import "./Projects.css";

const Projects = () => {
  const projectRefs = useRef([]);
  const [markerPositions, setMarkerPositions] = useState([]);

  useEffect(() => {
    // Capture top positions of each project card for accurate marker alignment
    const positions = projectRefs.current.map((ref) => ref?.offsetTop || 0);
    setMarkerPositions(positions);
  }, []);

  return (
    <section id="projects" className="projects-section">
      {/* Timeline (Left Side) */}
      <div className="timeline">
        <div className="timeline-line"></div>

        {/* Timeline Markers (Mapped to Projects) */}
        {projects.map((project, index) => (
          <div 
            key={index} 
            className="timeline-entry"
            style={{ 
              top: `${markerPositions[index]}px`
            }}
          >
            <div className="timeline-marker"></div>
            <div className="timeline-label">{project.timestamp}</div>
          </div>
        ))}
      </div>

      {/* Project Content (Aligned with Timeline) */}
      <div className="projects-content">
        <h1 className="h1-text">Projects Timeline</h1>
        {projects.map((project, index) => (
          <div 
            key={index} 
            className="project-card"
            ref={(el) => (projectRefs.current[index] = el)}
          >
            <h3>{project.title}</h3>
            <p>{project.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Projects;