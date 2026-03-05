"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, X } from "lucide-react";

interface ModalProps {
    id?: string;
    className?: string;
    role?: "alertdialog" | "dialog";
    "aria-modal"?: boolean;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    tabIndex?: number;

    // Functional props
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    icon?: React.ReactNode;
    variant?: "alert" | "success";
    children?: React.ReactNode;
}

export default function Modal({
    id,
    className = "",
    role = "alertdialog",
    "aria-modal": ariaModal = true,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    tabIndex = -1,
    isOpen,
    onClose,
    title = "Error",
    message,
    icon,
    variant = "alert",
    children,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle Escape key
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        },
        [onClose]
    );

    // Add/remove event listener and focus trap
    useEffect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            // Focus the modal when it opens
            modalRef.current?.focus();
            // Prevent body scroll when modal is open
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, handleKeyDown]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Default icon if not provided
    const isSuccess = variant === "success";
    const displayIcon =
        icon ??
        (isSuccess ? (
            <CheckCircle className="w-8 h-8 text-emerald-400" />
        ) : (
            <AlertTriangle className="w-8 h-8 text-red-500" />
        ));
    const iconWrapperClass = isSuccess
        ? "bg-emerald-500/20"
        : "bg-red-500/20";

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        ref={modalRef}
                        id={id}
                        className={`bg-zinc-800 rounded-2xl p-4 sm:p-6 w-full max-w-md relative ${className}`}
                        role={role}
                        aria-modal={ariaModal}
                        aria-labelledby={ariaLabelledby}
                        aria-describedby={ariaDescribedby}
                        tabIndex={tabIndex}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Icon */}
                        <div className="flex flex-col items-center mb-4">
                            <div
                                className={`w-16 h-16 ${iconWrapperClass} rounded-full flex items-center justify-center`}
                            >
                                {displayIcon}
                            </div>
                        </div>

                        {/* Title */}
                        {title && (
                            <h2
                                id={ariaLabelledby}
                                className="text-white text-lg sm:text-xl font-bold text-center mb-2"
                            >
                                {title}
                            </h2>
                        )}

                        {/* Message */}
                        {message && (
                            <p
                                id={ariaDescribedby}
                                className="text-zinc-400 text-sm text-center mb-6"
                            >
                                {message}
                            </p>
                        )}

                        {/* Custom Children */}
                        {children}

                        {/* Default Close Button */}
                        {!children && (
                            <button
                                onClick={onClose}
                                className="w-full mt-4 py-3 sm:py-4 border-2 border-primary text-primary font-bold text-base sm:text-lg rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
                            >
                                CLOSE
                            </button>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
