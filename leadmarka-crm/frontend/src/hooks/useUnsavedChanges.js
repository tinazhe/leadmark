import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const useUnsavedChanges = (shouldBlock) => {
  const location = useLocation();
  const navigate = useNavigate();
  const previousLocation = useRef(location);
  const skipPromptRef = useRef(false);

  useEffect(() => {
    const prev = previousLocation.current;
    const prevPath = `${prev.pathname}${prev.search}`;
    const nextPath = `${location.pathname}${location.search}`;

    if (!shouldBlock) {
      previousLocation.current = location;
      return;
    }

    if (skipPromptRef.current) {
      skipPromptRef.current = false;
      previousLocation.current = location;
      return;
    }

    if (prevPath !== nextPath) {
      const proceed = window.confirm('You have unsaved changes. Discard them?');
      if (!proceed) {
        skipPromptRef.current = true;
        navigate(prevPath, { replace: true });
        return;
      }
    }

    previousLocation.current = location;
  }, [location, navigate, shouldBlock]);

  useEffect(() => {
    if (!shouldBlock) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldBlock]);
};

export default useUnsavedChanges;
