/**
 * @file Container responsible for rendering and interactions in second half of forgot password
 * flow.
 */
import * as React from 'react'
import {Link, useLocation} from 'react-router-dom';
import toast from "react-hot-toast";

import {useAuth} from '../authentication';
import withRouter from '../navigation'
import {useInput} from '../hooks'
import {handleEvent} from '../utils';
import {LOGIN_PATH} from './app';


// ==============================
// === resetPasswordContainer ===
// ==============================

const resetPasswordContainer: React.FC<any> = () => {
    const {resetPassword} = useAuth();
    const {search} = useLocation();

    // Parse the verification code & email from the query params.
    const query = new URLSearchParams(search);
    const initialCode = query.get("verification_code");
    const initialEmail = query.get("email");

    const {value: email, bind: bindEmail} = useInput(initialEmail ?? "")
    const {value: code, bind: bindCode} = useInput(initialCode ?? "");
    const {value: newPassword, bind: bindNewPassword} = useInput("");
    const {value: newPasswordConfirm, bind: bindNewPasswordConfirm} = useInput("");

    const handleSubmit = () => {
        if (newPassword !== newPasswordConfirm) {
            toast.error("Passwords do not match");
            return Promise.resolve();
        }

        return resetPassword(email, code, newPassword)
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-300">
            <div
                className="flex flex-col bg-white shadow-md px-4 sm:px-6 md:px-8 lg:px-10 py-8 rounded-md w-full max-w-md">
                <div className="font-medium self-center text-xl sm:text-2xl uppercase text-gray-800">
                    Reset Your Password
                </div>
                <div className="mt-10">
                    <form onSubmit={handleEvent(handleSubmit)}>
                        <div className="flex flex-col mb-6">
                            <label
                                htmlFor="email"
                                className="mb-1 text-xs sm:text-sm tracking-wide text-gray-600"
                            >
                                E-Mail Address:
                            </label>
                            <div className="relative">
                                <div
                                    className="inline-flex items-center justify-center absolute left-0 top-0 h-full w-10 text-gray-400">
                                    <svg
                                        className="h-6 w-6"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                    </svg>
                                </div>

                                <input
                                    {...bindEmail}
                                    id="email"
                                    type="email"
                                    name="email"
                                    className="text-sm sm:text-base placeholder-gray-500 pl-10 pr-4 rounded-lg border border-gray-400 w-full py-2 focus:outline-none focus:border-blue-400"
                                    placeholder="E-Mail Address"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col mb-6">
                            <label
                                htmlFor="code"
                                className="mb-1 text-xs sm:text-sm tracking-wide text-gray-600"
                            >
                                Confirmation Code:
                            </label>
                            <div className="relative">
                                <div
                                    className="inline-flex items-center justify-center absolute left-0 top-0 h-full w-10 text-gray-400">
                                    <svg
                                        className="h-6 w-6"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                    </svg>
                                </div>

                                <input
                                    {...bindCode}
                                    id="code"
                                    type="text"
                                    name="code"
                                    className="text-sm sm:text-base placeholder-gray-500 pl-10 pr-4 rounded-lg border border-gray-400 w-full py-2 focus:outline-none focus:border-blue-400"
                                    placeholder="Confirmation Code"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col mb-6">
                            <label
                                htmlFor="new_password"
                                className="mb-1 text-xs sm:text-sm tracking-wide text-gray-600"
                            >
                                New Password:
                            </label>
                            <div className="relative">
                                <div
                                    className="inline-flex items-center justify-center absolute left-0 top-0 h-full w-10 text-gray-400">
                                    <svg
                                        className="h-6 w-6"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                    </svg>
                                </div>

                                <input
                                    {...bindNewPassword}
                                    id="new_password"
                                    type="password"
                                    name="new_password"
                                    className="text-sm sm:text-base placeholder-gray-500 pl-10 pr-4 rounded-lg border border-gray-400 w-full py-2 focus:outline-none focus:border-blue-400"
                                    placeholder="New Password"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col mb-6">
                            <label
                                htmlFor="new_password_confirm"
                                className="mb-1 text-xs sm:text-sm tracking-wide text-gray-600"
                            >
                                Confirm New Password:
                            </label>
                            <div className="relative">
                                <div
                                    className="inline-flex items-center justify-center absolute left-0 top-0 h-full w-10 text-gray-400">
                                    <svg
                                        className="h-6 w-6"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
                                    </svg>
                                </div>

                                <input
                                    {...bindNewPasswordConfirm}
                                    id="new_password_confirm"
                                    type="password"
                                    name="new_password_confirm"
                                    className="text-sm sm:text-base placeholder-gray-500 pl-10 pr-4 rounded-lg border border-gray-400 w-full py-2 focus:outline-none focus:border-blue-400"
                                    placeholder="Confirm New Password"
                                />
                            </div>
                        </div>
                        <div className="flex w-full">
                            <button
                                type="submit"
                                className="flex items-center justify-center focus:outline-none text-white text-sm sm:text-base bg-blue-600 hover:bg-blue-700 rounded py-2 w-full transition duration-150 ease-in"
                            >
                                <span className="mr-2 uppercase">Reset</span>
                                <span>
                    <svg
                        className="h-6 w-6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                      <path d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </span>
                            </button>
                        </div>
                    </form>
                </div>
                <div className="flex justify-center items-center mt-6">
                    <Link
                        to={LOGIN_PATH}
                        className="inline-flex items-center font-bold text-blue-500 hover:text-blue-700 text-xs text-center"
                    >
              <span>
                <svg
                    className="h-6 w-6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                  <path
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
              </span>
                        <span className="ml-2">Go back to login</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default withRouter(resetPasswordContainer)


