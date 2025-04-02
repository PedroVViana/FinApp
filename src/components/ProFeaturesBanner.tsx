import { useState } from 'react';

interface ProFeaturesBannerProps {
  title: string;
  description: string;
  features: string[];
}

export function ProFeaturesBanner({ title, description, features }: ProFeaturesBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <p className="mb-4">{description}</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-white text-rose-500 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition-colors"
        >
          Upgrade para Premium
        </button>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Recursos Premium:</h4>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center text-sm">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 