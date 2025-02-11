import React from 'react';
import "./Resume.css";

const Resume = () => {
  return (
    <section id="resume" className="section text-center bg-gray-800 text-white">
      <h2 className="h1-text">Resume</h2>
      <div className="flex justify-center">
        <img
          src="/images/resume.jpg"
          alt="Adam Dsouza Resume"
          className="shadow-lg w-3/4 mx-auto card-hover"
          id="zoomableImage"
        />
      </div>
    </section>
  );
};

export default Resume;
