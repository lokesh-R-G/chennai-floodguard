import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/auth");
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  return null;
};

export default Index;
