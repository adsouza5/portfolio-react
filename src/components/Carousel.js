import React, { useState } from 'react';

const Carousel = ({ images, altTexts }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
  };

  const handleNext = () => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
  };

  return (
    <div className="relative mt-8 flex justify-center items-center">
      <button onClick={handlePrev} className="absolute left-0 bg-gray-800 text-white px-4 py-2 rounded-full hover:bg-gray-600 z-10">
        &#8592;
      </button>
      <div className="carousel-container overflow-hidden w-full max-w-2xl h-96 relative flex items-center justify-center">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={altTexts && altTexts[index] ? altTexts[index] : `Slide ${index + 1}`}
            className={`absolute w-auto h-full max-h-full transition-transform duration-500 ${
              index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        ))}
      </div>
      <button onClick={handleNext} className="absolute right-0 bg-gray-800 text-white px-4 py-2 rounded-full hover:bg-gray-600 z-10">
        &#8594;
      </button>
    </div>
  );
};

export default Carousel;
