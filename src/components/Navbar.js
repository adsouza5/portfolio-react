import React, {
  useState,
  useEffect,
} from "react";
import "./Navbar.css";

const Navbar = () => {
  const [activeSection, setActiveSection] =
    useState("home");

  useEffect(() => {
    const sections = [
      "home",
      "resume",
      "projects",
    ];

    const handleScroll = () => {
      let currentSection = "home"; // default section

      // Loop through each section and determine if it is in view
      sections.forEach((sectionId) => {
        const element =
          document.getElementById(sectionId);
        if (element) {
          const rect =
            element.getBoundingClientRect();
          // Use a threshold (e.g., 100px from the top) to decide if the section is active
          if (
            rect.top <= 100 &&
            rect.bottom >= 100
          ) {
            currentSection = sectionId;
          }
        }
      });

      setActiveSection(currentSection);
    };

    window.addEventListener(
      "scroll",
      handleScroll
    );
    // Call once to set the initial active section
    handleScroll();

    return () =>
      window.removeEventListener(
        "scroll",
        handleScroll
      );
  }, []);
  return (
    <nav className="navbar">
      <a
        href="#home"
        className={
          activeSection === "home" ? "active" : ""
        }
      >
        Home
      </a>
      <a
        href="#projects"
        className={
          activeSection === "projects"
            ? "active"
            : ""
        }
      >
        Projects
      </a>
      <a
        href="#resume"
        className={
          activeSection === "resume"
            ? "active"
            : ""
        }
      >
        Resume
      </a>
    </nav>
  );
};

export default Navbar;
