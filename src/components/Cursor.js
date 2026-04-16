import React, { useEffect, useRef } from 'react';
import './Cursor.css';

const Cursor = () => {
  const spotRef = useRef(null);

  useEffect(() => {
    const move = (e) => {
      if (spotRef.current) {
        spotRef.current.style.left = `${e.clientX}px`;
        spotRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return <div className="cursor-spotlight" ref={spotRef} />;
};

export default Cursor;
