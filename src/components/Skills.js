import React from 'react';
import './Skills.css';

const SKILLS = [
  'Kotlin', 'Java', 'Python', 'JavaScript', 'C/C++', 'SQL', 'Bash',
  'React', 'React Native', 'Node.js', 'Jetpack Compose', 'D3.js',
  'Firebase', 'AWS', 'WebRTC', 'REST APIs', 'Git', 'OpenCV',
  'Agile', 'CI/CD',
];

const Skills = () => (
  <div className="skills-strip">
    <span className="skills-label">{'// tech stack'}</span>
    <div className="skills-tags">
      {SKILLS.map((skill) => (
        <span key={skill} className="skill-tag">{skill}</span>
      ))}
    </div>
  </div>
);

export default Skills;
