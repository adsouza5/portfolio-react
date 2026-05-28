import React from 'react';
import './Skills.css';

const SKILLS = [
  'Go', 'Python', 'TypeScript', 'JavaScript', 'Kotlin', 'Java', 'SQL', 'Bash',
  'React', 'React Native', 'Node.js', 'FastAPI',
  'GCP', 'AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'PostgreSQL', 'Redis', 'Firebase',
  'scikit-learn', 'Qdrant', 'OpenAI API', 'REST APIs', 'Git',
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
