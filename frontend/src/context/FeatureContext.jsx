import React, { createContext, useContext, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const FeatureContext = createContext({
  features: [],
  hasFeature: () => false,
});

export const useFeatures = () => useContext(FeatureContext);

export const FeatureProvider = ({ children }) => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const response = await fetch('/api/config/features');
        if (response.ok) {
          const data = await response.json();
          setFeatures(data.features || []);
        } else {
          console.error("Failed to fetch feature flags");
        }
      } catch (error) {
        console.error("Error fetching feature flags:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  const hasFeature = (featureName) => {
    return features.includes(featureName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <FeatureContext.Provider value={{ features, hasFeature }}>
      {children}
    </FeatureContext.Provider>
  );
};

export const Feature = ({ name, children, fallback = null }) => {
  const { hasFeature } = useFeatures();

  if (hasFeature(name)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
