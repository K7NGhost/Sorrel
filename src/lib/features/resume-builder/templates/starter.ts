export const starterResume = String.raw`\documentclass[11pt]{article}
\usepackage[margin=0.65in]{geometry}
\usepackage{fontspec}
\usepackage{hyperref}
\usepackage{enumitem}
\setmainfont{lmroman10-regular.otf}[
  BoldFont=lmroman10-bold.otf,
  ItalicFont=lmroman10-italic.otf,
  BoldItalicFont=lmroman10-bolditalic.otf
]
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=*, itemsep=2pt, topsep=3pt}

\begin{document}

\begin{center}
{\LARGE \textbf{Your Name}}\\
your.email@example.com --- (555) 123-4567\\
City, State --- linkedin.com/in/yourname
\end{center}

\section*{Summary}
Write two or three sentences about your experience, strengths, and the
kind of role you are looking for.

\section*{Experience}
\textbf{Your Job Title --- Company Name}\\
\textit{January 2024 -- Present}
\begin{itemize}
  \item Describe an achievement and the impact it made.
  \item Include a measurable result, such as improving performance by 30\%.
  \item Explain how you collaborated with your team to deliver a project.
\end{itemize}

\section*{Projects}
\textbf{Project Name}
\begin{itemize}
  \item Explain the problem you solved and the tools you used.
  \item Highlight a result or a link where someone can learn more.
\end{itemize}

\section*{Education}
\textbf{Degree or Qualification --- Institution}\\
\textit{Graduation year}

\section*{Skills}
\textbf{Technical:} List your tools, languages, and frameworks.\\
\textbf{Other:} List relevant languages, certifications, or strengths.

\end{document}
`;
