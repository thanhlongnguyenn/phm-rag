import "./global.css";
import Navigation from "@/components/Navigation";

export const metadata = {
  title: "Diabetes Management Chat",
  description:
    "A chatbot that helps you manage your condition in a reliable way.",
};

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
