import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import handFlowers from "../assets/hand-flowers.webp";
import storeMap from "../assets/store-map.webp";
import floralBg from "../assets/floral-bg.webp";

const Home = () => {
  const navigate = useNavigate();
  const mapBoxRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = window.innerWidth <= 768;
  const [collapsed, setCollapsed] = useState(isMobile);

  useEffect(() => {
    const observerTarget = mapBoxRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );

    if (observerTarget) observer.observe(observerTarget);

    return () => {
      if (observerTarget) observer.unobserve(observerTarget);
    };
  }, []);

  return (
    <div className="relative overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative z-[1] flex min-h-screen items-start justify-center overflow-hidden bg-white px-8 py-16 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px origin-center bg-cover bg-no-repeat bg-[position:75%_center] md:bg-center [transform:scaleX(-1)]"
          style={{ backgroundImage: `url(${floralBg})` }}
        />

        <img
          src={handFlowers}
          alt="Hand holding flowers"
          className="pointer-events-none absolute bottom-0 right-0 z-0 hidden h-[90%] max-w-[45vw] object-contain drop-shadow-[55px_20px_40px_rgba(0,0,0,0.5)] md:block"
        />

        <div className="relative z-[2] mt-8 max-w-[700px] rounded-2xl bg-white/60 p-6 text-[#333] shadow-[0_4px_12px_rgba(0,0,0,0.1)] sm:p-8">
          <h1 className="mb-4 text-[3rem] text-[#c7668b]">Nail Times</h1>
          <p className="mb-8 text-[1.2rem] text-[#555]">
            Family-owned, Nail Times brings personalized care and elegance to every visit.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <button
              className="inline-block rounded-full bg-[#e4a3b8] px-6 py-3 text-center text-base font-bold text-white animate-fade-in-up"
              style={{ animationDelay: "300ms" }}
              onClick={() => navigate("/services")}
            >
              VIEW ALL SERVICES
            </button>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <section className="relative h-screen w-full overflow-hidden">
        <img src={storeMap} alt="Map to Nail Times" className="h-full w-full object-cover" />
        <div
          ref={mapBoxRef}
          className={`absolute left-1/2 top-6 z-[2] w-[calc(100%-2rem)] max-w-[380px] -translate-x-1/2 rounded-[20px] bg-[#2c2c2c] p-6 font-['Segoe_UI',_sans-serif] text-[#f9f9f9] opacity-0 transition-all duration-500 ease-out md:left-[50px] md:top-[100px] md:w-auto md:max-w-[320px] md:translate-x-0 md:p-8 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-5"
          }`}
        >
          {isMobile && (
            <button
              className="mb-4 inline-flex items-center gap-2 rounded-xl bg-[#fcebef] px-4 py-2 text-sm font-bold text-[#c7668b] transition-colors hover:bg-[#f5a5c2] hover:text-white"
              onClick={() => setCollapsed(!collapsed)}
            >
              <span>{collapsed ? "Hours" : "Hide Info"}</span>
              <span
                aria-hidden="true"
                className={
                  collapsed
                    ? "mt-[1px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-current"
                    : "mt-[1px] h-0 w-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-current"
                }
              />
            </button>
          )}

          {!collapsed && (
            <>
              {!isMobile && <h3 className="mb-4 text-2xl text-white">Working Hours</h3>}
              <ul className="mb-6 list-none p-0">
                <li className="flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Monday</span> <span className="text-black">9:00AM - 7:30PM</span>
                </li>
                <li className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Tuesday</span> <span className="text-black">9:00AM - 7:30PM</span>
                </li>
                <li className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Wednesday</span> <span className="text-black">9:00AM - 7:30PM</span>
                </li>
                <li className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Thursday</span> <span className="text-black">9:00AM - 7:30PM</span>
                </li>
                <li className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Friday</span> <span className="text-black">9:00AM - 7:30PM</span>
                </li>
                <li className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Saturday</span> <span className="text-black">9:00AM - 7:00PM</span>
                </li>
                <li className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-white/90 px-3 py-1 text-[0.95rem] text-black shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                  <span className="text-black">Sunday</span> <span className="text-black">12:00PM - 6:00PM</span>
                </li>
              </ul>
              <h4 className="mb-1 text-base text-[#f5a5c2]">Address</h4>
              <p className="mb-4 text-base text-[#fff]">
                6817 W Northwest Hwy
                <br />
                Dallas, TX 75225
              </p>

              <h4 className="mb-1 text-base text-[#f5a5c2]">Book by Phone</h4>
              <p className="text-base text-[#444]">
                <a className="font-bold text-[#f5a5c2] no-underline" href="tel:+12143631510">
                  +1 (214) 363-1510
                </a>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;

