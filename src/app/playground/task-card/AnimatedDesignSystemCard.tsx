import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type Task = {
  id: string;
  label: string;
  checked: boolean;
};

type PriorityValue = "Low" | "Medium" | "High" | "Urgent";
type StatusValue = "Backlog" | "In Review" | "In Progress" | "Done";
type SelectValue = PriorityValue | StatusValue;
type MenuKind = "priority" | "status" | null;

type Assignee = {
  name: string;
  initials: string;
  ink: string;
  wash: string;
  ring: string;
};

const initialTasks: Task[] = [
  { id: "tokens", label: "Design Tokens", checked: true },
  { id: "color", label: "Color System", checked: true },
  { id: "type", label: "Type System", checked: true },
  { id: "docs", label: "Documentation", checked: false },
];

const priorityOptions: PriorityValue[] = ["Low", "Medium", "High", "Urgent"];
const statusOptions: StatusValue[] = [
  "Backlog",
  "In Review",
  "In Progress",
  "Done",
];

const priorityStyles: Record<PriorityValue, string> = {
  Low: "bg-[#E9ECE7] text-[#596052]",
  Medium: "bg-[#DDEBFF] text-[#31547A]",
  High: "bg-[#FFE0C2] text-[#8A4D1E]",
  Urgent: "bg-[#F8CCD5] text-[#8D3542]",
};

const statusStyles: Record<StatusValue, string> = {
  Backlog: "bg-[#EAEAE5] text-[#60605B]",
  "In Review": "bg-[#DFE9FF] text-[#345A88]",
  "In Progress": "bg-[#F6E7B8] text-[#6B5831]",
  Done: "bg-[#DDF4E5] text-[#276B3D]",
};

const assignees: Assignee[] = [
  {
    name: "Chloe",
    initials: "CH",
    ink: "#2F5E72",
    wash: "#DDF5FF",
    ring: "#BFEAFF",
  },
  {
    name: "Anna",
    initials: "AN",
    ink: "#7D3F7A",
    wash: "#FFE2FA",
    ring: "#FFD2F8",
  },
  {
    name: "Ramesh",
    initials: "RA",
    ink: "#88414A",
    wash: "#FFE0E2",
    ring: "#FFD0D3",
  },
];

const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.9,
};

const fadeSpring: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 42,
  mass: 0.7,
};

const reducedTransition: Transition = { duration: 0.18, ease: "easeOut" };
const reducedFadeTransition: Transition = { duration: 0.16, ease: "easeOut" };

export function AnimatedDesignSystemCard() {
  const prefersReducedMotion = useReducedMotion();
  const [taskItems, setTaskItems] = useState<Task[]>(initialTasks);
  const [priority, setPriority] = useState<PriorityValue>("Urgent");
  const [status, setStatus] = useState<StatusValue>("In Progress");
  const [openMenu, setOpenMenu] = useState<MenuKind>(null);
  const [expanded, setExpanded] = useState(getInitialExpanded);
  const [autoPlay, setAutoPlay] = useState(
    () => !prefersReducedMotion && getInitialAutoPlay(),
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setAutoPlay(false);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!autoPlay || prefersReducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setExpanded((current) => !current);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [autoPlay, prefersReducedMotion]);

  const transition = prefersReducedMotion ? reducedTransition : spring;

  const contentTransition = prefersReducedMotion
    ? reducedFadeTransition
    : fadeSpring;

  const completedTasks = taskItems.filter((task) => task.checked).length;
  const progress = Math.round((completedTasks / taskItems.length) * 100);

  const cardSize = useMemo(
    () =>
      expanded
        ? "min-h-[410px] w-full max-w-[560px] rounded-[26px] p-6 sm:p-7"
        : "min-h-[92px] w-full max-w-[560px] rounded-[21px] px-4 py-3 sm:px-6 sm:py-4",
    [expanded],
  );

  const pauseAutoPlay = () => setAutoPlay(false);

  const toggleCard = () => {
    pauseAutoPlay();
    setOpenMenu(null);
    setExpanded((current) => !current);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCard();
    }
  };

  const stopCardToggle = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  const toggleTask = (id: string) => {
    pauseAutoPlay();
    setTaskItems((current) =>
      current.map((task) =>
        task.id === id ? { ...task, checked: !task.checked } : task,
      ),
    );
  };

  const choosePriority = (value: PriorityValue) => {
    pauseAutoPlay();
    setPriority(value);
    setOpenMenu(null);
  };

  const chooseStatus = (value: StatusValue) => {
    pauseAutoPlay();
    setStatus(value);
    setOpenMenu(null);
  };

  return (
    <section className="relative flex w-full max-w-[680px] flex-col items-center gap-7">
      <motion.div
        role="button"
        tabIndex={0}
        layout
        transition={transition}
        onClick={toggleCard}
        onKeyDown={handleCardKeyDown}
        aria-label={
          expanded
            ? "Collapse Design System project card"
            : "Expand Design System project card"
        }
        aria-expanded={expanded}
        className={`${cardSize} group relative cursor-pointer overflow-visible border border-line bg-[rgb(254,254,252)] text-left shadow-card outline-none transition-[box-shadow,border-color] duration-200 hover:border-[#DEDED8] focus-visible:ring-4 focus-visible:ring-[#24C35D]/15`}
      >
        <motion.div
          layout
          transition={transition}
          className={
            expanded
              ? "flex h-full flex-col gap-6"
                : "grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-3 sm:min-h-[60px] sm:gap-x-9"
          }
        >
          <motion.div
            layout
            transition={transition}
            className={
              expanded
                ? "flex items-center justify-between gap-3 sm:gap-4"
                : "col-start-1 row-start-1 flex min-w-0 items-center"
            }
          >
            <motion.div
              layout
              layoutId="title-tag"
              transition={transition}
              className={
                expanded
                  ? "flex min-w-0 items-center gap-3 sm:gap-4"
                  : "flex min-w-0 max-w-[182px] items-center gap-2 rounded-[10px] bg-[#F4F4F2] py-1.5 pl-1.5 pr-2.5 ring-1 ring-[#EEEEEA] sm:max-w-none sm:pr-3"
              }
            >
              <ProjectIcon compact={!expanded} transition={transition} />
              <motion.h1
                layoutId="card-title"
                transition={transition}
                className={
                  expanded
                    ? "truncate text-[24px] font-bold leading-none tracking-[0] text-ink sm:text-[31px]"
                    : "truncate text-[16px] font-semibold leading-none tracking-[0] text-ink sm:text-[18px]"
                }
              >
                Design System
              </motion.h1>
            </motion.div>

            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.button
                  key="menu"
                  type="button"
                  onClick={(event) => {
                    stopCardToggle(event);
                    pauseAutoPlay();
                  }}
                  initial={{ opacity: 0, scale: 0.84, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.84, y: -4 }}
                  transition={contentTransition}
                  className="grid size-11 shrink-0 place-items-center rounded-[12px] border border-line bg-[rgb(254,254,252)] text-ink shadow-[0_4px_12px_rgba(31,31,27,0.04)] transition-colors hover:bg-[#F7F7F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#24C35D]/15 sm:size-12 sm:rounded-[13px]"
                  aria-label="Project actions"
                >
                  <DotsIcon />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </motion.div>

          <motion.div
            layout
            layoutId="progress-row"
            transition={transition}
            className={
              expanded
                ? "flex w-fit max-w-full items-center gap-3 rounded-full border border-line bg-[rgb(254,254,252)] px-3.5 py-2 text-[17px] font-medium text-mute shadow-[0_4px_12px_rgba(38,38,36,0.035)]"
                : "col-start-2 row-start-1 flex items-center justify-end gap-2.5 text-[21px] font-medium text-mute sm:gap-5 sm:text-[22px]"
            }
          >
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.span
                  key="progress-check"
                  initial={{ opacity: 0, scale: 0.72 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.72 }}
                  transition={contentTransition}
                  className="grid size-6 place-items-center rounded-full border border-[#DADAD5] text-[#A8A8A2]"
                  aria-hidden="true"
                >
                  <CheckMiniIcon />
                </motion.span>
              ) : null}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.span
                  key="progress-count"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={contentTransition}
                  className="whitespace-nowrap"
                >
                  {completedTasks} of {taskItems.length}
                </motion.span>
              ) : null}
            </AnimatePresence>
            <ProgressBar
              expanded={expanded}
              progress={progress}
              transition={transition}
            />
            <motion.span layoutId="progress-percent" transition={transition}>
              {progress}%
            </motion.span>
          </motion.div>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                key="expanded-details"
                initial={{ opacity: 0, y: -18, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -24, height: 0 }}
                transition={contentTransition}
                className="overflow-hidden"
              >
                <Checklist tasks={taskItems} onToggleTask={toggleTask} />
                <MetadataRows
                  priority={priority}
                  status={status}
                  openMenu={openMenu}
                  onOpenMenu={setOpenMenu}
                  onChoosePriority={choosePriority}
                  onChooseStatus={chooseStatus}
                  onStopCardToggle={stopCardToggle}
                  transition={transition}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div
            layout
            layoutId="footer-row"
            transition={transition}
            className={
              expanded
                ? "mt-auto flex flex-wrap items-center gap-3"
                : "col-span-2 col-start-1 row-start-2 flex min-w-0 items-center justify-between gap-3 sm:gap-5"
            }
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {!expanded ? (
                <motion.div
                  key="compact-meta"
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={contentTransition}
                  className="flex min-w-0 items-center gap-2 text-[15px] font-medium text-[#6D6D68] sm:gap-6 sm:text-[20px]"
                >
                  <CompactMeta
                    icon={<FlagIcon />}
                    label={priority}
                    tone="urgent"
                    menuKind="priority"
                    isOpen={openMenu === "priority"}
                    options={priorityOptions}
                    onOpenMenu={setOpenMenu}
                    onChoose={(value) => choosePriority(value as PriorityValue)}
                    onStopCardToggle={stopCardToggle}
                    transition={transition}
                  />
                  <CompactMeta
                    icon={<HourglassIcon />}
                    label={status}
                    tone="progress"
                    menuKind="status"
                    isOpen={openMenu === "status"}
                    options={statusOptions}
                    onOpenMenu={setOpenMenu}
                    onChoose={(value) => chooseStatus(value as StatusValue)}
                    onStopCardToggle={stopCardToggle}
                    transition={transition}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.div
              layout
              transition={transition}
              className={
                expanded
                  ? "flex flex-wrap items-center gap-3"
                  : "ml-auto flex shrink-0 items-center justify-end"
              }
            >
              {assignees.map((assignee, index) => (
                <AssigneeAvatar
                  key={assignee.name}
                  assignee={assignee}
                  index={index}
                  expanded={expanded}
                  transition={transition}
                  contentTransition={contentTransition}
                  onStopCardToggle={stopCardToggle}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="flex items-center gap-3 rounded-full border border-line bg-[rgb(254,254,252)] px-4 py-2 shadow-[0_10px_24px_rgba(28,28,24,0.05)]">
        <span className="text-sm font-medium text-[#595954]">Auto-play</span>
        <button
          type="button"
          disabled={Boolean(prefersReducedMotion)}
          onClick={() => setAutoPlay((current) => !current)}
          aria-pressed={autoPlay}
          className={`relative h-7 w-12 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#24C35D]/15 disabled:cursor-not-allowed disabled:opacity-45 ${
            autoPlay
              ? "border-[#1FB654] bg-[#24C35D]"
              : "border-[#DCDCD7] bg-[#ECECEA]"
          }`}
        >
          <motion.span
            layout
            transition={transition}
            className="absolute top-1 size-5 rounded-full bg-[rgb(254,254,252)] shadow-[0_2px_6px_rgba(28,28,24,0.22)]"
            animate={{ left: autoPlay ? 22 : 4 }}
          />
        </button>
      </div>
    </section>
  );
}

function getInitialExpanded() {
  if (typeof window === "undefined") {
    return true;
  }

  return new URLSearchParams(window.location.search).get("state") !== "compact";
}

function getInitialAutoPlay() {
  if (typeof window === "undefined") {
    return true;
  }

  const value = new URLSearchParams(window.location.search).get("autoplay");
  return value !== "0" && value !== "false";
}

function ProjectIcon({
  compact,
  transition,
}: {
  compact: boolean;
  transition: Transition;
}) {
  return (
    <motion.span
      layoutId="project-icon"
      transition={transition}
      className={`grid shrink-0 place-items-center border border-line bg-[rgb(254,254,252)] shadow-[0_8px_18px_rgba(31,31,27,0.05)] ${
        compact
          ? "size-9 rounded-[9px]"
          : "size-14 rounded-[14px] sm:size-16 sm:rounded-[15px]"
      }`}
      aria-hidden="true"
    >
      <motion.svg
        layout
        width={compact ? 24 : 40}
        height={compact ? 24 : 40}
        viewBox="0 0 40 40"
        fill="none"
      >
        <path
          d="M20 5.8 32.4 12.9v14.2L20 34.2 7.6 27.1V12.9L20 5.8Z"
          stroke="#6F6F69"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="5.8" stroke="#6F6F69" strokeWidth="2.4" />
        <path
          d="M20 10.5v3.2M20 26.3v3.2M10.4 20h3.2M26.4 20h3.2"
          stroke="#A1A19B"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.svg>
    </motion.span>
  );
}

function ProgressBar({
  expanded,
  progress,
  transition,
}: {
  expanded: boolean;
  progress: number;
  transition: Transition;
}) {
  return (
    <motion.span
      layoutId="progress-track"
      transition={transition}
      className={`relative block shrink-0 overflow-hidden rounded-full bg-[#DEDED8] ${
        expanded ? "h-3 w-[136px]" : "h-3 w-[78px] sm:w-[178px]"
      }`}
      aria-hidden="true"
    >
      <motion.span
        layoutId="progress-fill"
        transition={transition}
        className="absolute inset-y-0 left-0 rounded-full bg-progress"
        style={{ width: `${progress}%` }}
      />
    </motion.span>
  );
}

function Checklist({
  tasks,
  onToggleTask,
}: {
  tasks: Task[];
  onToggleTask: (id: string) => void;
}) {
  return (
    <div className="relative mb-5 ml-8 mt-1 pl-[54px]">
      <span
        aria-hidden="true"
        className="absolute left-[18px] top-[-2px] h-[178px] w-[29px] rounded-bl-[12px] border-b-2 border-l-2 border-[#E3E3DE]"
      />
      <span
        aria-hidden="true"
        className="absolute left-[18px] top-[52px] h-[2px] w-[26px] bg-[#E3E3DE]"
      />
      <span
        aria-hidden="true"
        className="absolute left-[18px] top-[105px] h-[2px] w-[26px] bg-[#E3E3DE]"
      />
      {tasks.map((task, index) => (
        <motion.button
          type="button"
          key={task.label}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTask(task.id);
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ ...fadeSpring, delay: index * 0.025 }}
          className="relative flex h-[48px] items-center gap-4 rounded-[12px] pr-3 text-left outline-none transition-colors hover:bg-[#F8F8F5] focus-visible:ring-4 focus-visible:ring-[#24C35D]/15"
          aria-pressed={task.checked}
          aria-label={`${task.checked ? "Mark incomplete" : "Mark complete"}: ${
            task.label
          }`}
        >
          <motion.span
            layout
            className={`grid size-8 shrink-0 place-items-center rounded-full ${
              task.checked
                ? "bg-[#555550] text-[rgb(254,254,252)]"
                : "border-2 border-[#CFCFC9] bg-[rgb(254,254,252)]"
            }`}
            aria-hidden="true"
          >
            <AnimatePresence initial={false}>
              {task.checked ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.68 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.68 }}
                  transition={fadeSpring}
                >
                  <CheckIcon />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.span>
          <span className="text-[22px] font-medium leading-none text-[#7B7B77]">
            {task.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function MetadataRows({
  priority,
  status,
  openMenu,
  onOpenMenu,
  onChoosePriority,
  onChooseStatus,
  onStopCardToggle,
  transition,
}: {
  priority: PriorityValue;
  status: StatusValue;
  openMenu: MenuKind;
  onOpenMenu: (kind: MenuKind) => void;
  onChoosePriority: (value: PriorityValue) => void;
  onChooseStatus: (value: StatusValue) => void;
  onStopCardToggle: (event: MouseEvent | KeyboardEvent) => void;
  transition: Transition;
}) {
  return (
    <div className="space-y-4 pb-4 text-[22px] font-medium text-[#61615C]">
      <MetadataRow
        icon={<FlagIcon />}
        label="Priority"
        value={priority}
        tone="urgent"
        menuKind="priority"
        isOpen={openMenu === "priority"}
        options={priorityOptions}
        onOpenMenu={onOpenMenu}
        onChoose={(value) => onChoosePriority(value as PriorityValue)}
        onStopCardToggle={onStopCardToggle}
        transition={transition}
      />
      <MetadataRow
        icon={<HourglassIcon />}
        label="Status"
        value={status}
        tone="progress"
        menuKind="status"
        isOpen={openMenu === "status"}
        options={statusOptions}
        onOpenMenu={onOpenMenu}
        onChoose={(value) => onChooseStatus(value as StatusValue)}
        onStopCardToggle={onStopCardToggle}
        transition={transition}
      />
    </div>
  );
}

function MetadataRow({
  icon,
  label,
  value,
  tone,
  menuKind,
  isOpen,
  options,
  onOpenMenu,
  onChoose,
  onStopCardToggle,
  transition,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "urgent" | "progress";
  menuKind: Exclude<MenuKind, null>;
  isOpen: boolean;
  options: SelectValue[];
  onOpenMenu: (kind: MenuKind) => void;
  onChoose: (value: SelectValue) => void;
  onStopCardToggle: (event: MouseEvent | KeyboardEvent) => void;
  transition: Transition;
}) {
  return (
    <div className="flex items-center gap-6">
      <span className="flex min-w-[132px] items-center gap-4">
        <motion.span
          layoutId={`${tone}-icon`}
          transition={transition}
          className="grid size-7 place-items-center text-[#A1A19C]"
        >
          {icon}
        </motion.span>
        <span>{label}</span>
      </span>
      <StatusPill
        value={value}
        tone={tone}
        expanded
        menuKind={menuKind}
        isOpen={isOpen}
        options={options}
        onOpenMenu={onOpenMenu}
        onChoose={onChoose}
        onStopCardToggle={onStopCardToggle}
        transition={transition}
      />
    </div>
  );
}

function CompactMeta({
  icon,
  label,
  tone,
  menuKind,
  isOpen,
  options,
  onOpenMenu,
  onChoose,
  onStopCardToggle,
  transition,
}: {
  icon: ReactNode;
  label: string;
  tone: "urgent" | "progress";
  menuKind: Exclude<MenuKind, null>;
  isOpen: boolean;
  options: SelectValue[];
  onOpenMenu: (kind: MenuKind) => void;
  onChoose: (value: SelectValue) => void;
  onStopCardToggle: (event: MouseEvent | KeyboardEvent) => void;
  transition: Transition;
}) {
  return (
    <span className="relative flex min-w-0 items-center gap-1.5 whitespace-nowrap sm:gap-2">
      <motion.span
        layoutId={`${tone}-icon`}
        transition={transition}
        className="grid size-5 shrink-0 place-items-center text-[#A8A8A3] sm:size-6"
      >
        {icon}
      </motion.span>
      <motion.button
        type="button"
        layoutId={`${tone}-value-shell`}
        transition={transition}
        onClick={(event) => {
          onStopCardToggle(event);
          onOpenMenu(isOpen ? null : menuKind);
        }}
        className="truncate rounded-[8px] text-[#6D6D68] outline-none transition-colors hover:text-ink focus-visible:ring-4 focus-visible:ring-[#24C35D]/15"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {label}
      </motion.button>
      <OptionMenu
        align="left"
        placement="top"
        isOpen={isOpen}
        options={options}
        value={label}
        onChoose={onChoose}
        onStopCardToggle={onStopCardToggle}
      />
    </span>
  );
}

function StatusPill({
  value,
  tone,
  expanded,
  menuKind,
  isOpen,
  options,
  onOpenMenu,
  onChoose,
  onStopCardToggle,
  transition,
}: {
  value: string;
  tone: "urgent" | "progress";
  expanded: boolean;
  menuKind: Exclude<MenuKind, null>;
  isOpen: boolean;
  options: SelectValue[];
  onOpenMenu: (kind: MenuKind) => void;
  onChoose: (value: SelectValue) => void;
  onStopCardToggle: (event: MouseEvent | KeyboardEvent) => void;
  transition: Transition;
}) {
  return (
    <span className="relative inline-flex">
      <motion.button
        type="button"
        layoutId={`${tone}-value-shell`}
        transition={transition}
        onClick={(event) => {
          onStopCardToggle(event);
          onOpenMenu(isOpen ? null : menuKind);
        }}
        className={`inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[17px] font-semibold leading-none outline-none transition-[filter,transform] hover:brightness-[0.98] focus-visible:ring-4 focus-visible:ring-[#24C35D]/15 ${
          tone === "urgent"
            ? priorityStyles[value as PriorityValue]
            : statusStyles[value as StatusValue]
        } ${expanded ? "" : "px-0 py-0"}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span>{value}</span>
        {expanded ? (
          <span className="grid size-5 place-items-center rounded-md bg-[rgba(254,254,252,0.42)]">
            <ChevronDownIcon />
          </span>
        ) : null}
      </motion.button>
      <OptionMenu
        align="right"
        placement="top"
        isOpen={isOpen}
        options={options}
        value={value}
        onChoose={onChoose}
        onStopCardToggle={onStopCardToggle}
      />
    </span>
  );
}

function OptionMenu({
  align,
  placement,
  isOpen,
  options,
  value,
  onChoose,
  onStopCardToggle,
}: {
  align: "left" | "right";
  placement: "top" | "bottom";
  isOpen: boolean;
  options: SelectValue[];
  value: string;
  onChoose: (value: SelectValue) => void;
  onStopCardToggle: (event: MouseEvent | KeyboardEvent) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.div
          role="menu"
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: placement === "bottom" ? 6 : -6,
          }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={fadeSpring}
          onClick={onStopCardToggle}
          onKeyDown={onStopCardToggle}
          className={`absolute z-30 min-w-[154px] rounded-[14px] border border-line bg-[rgb(254,254,252)] p-1.5 shadow-[0_18px_42px_rgba(28,28,24,0.13),0_2px_7px_rgba(28,28,24,0.07)] ${
            align === "right" ? "right-0" : "left-0"
          } ${placement === "bottom" ? "top-full" : "bottom-full"}`}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              onClick={(event) => {
                event.stopPropagation();
                onChoose(option);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[14px] font-semibold text-[#5F5F5A] outline-none transition-colors hover:bg-[#F5F5F2] focus-visible:bg-[#F5F5F2] ${
                option === value ? "bg-[#F1F1EE] text-ink" : ""
              }`}
            >
              <span>{option}</span>
              <span
                className={`size-2 rounded-full ${
                  option === value ? "bg-progress" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </button>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function AssigneeAvatar({
  assignee,
  index,
  expanded,
  transition,
  contentTransition,
  onStopCardToggle,
}: {
  assignee: Assignee;
  index: number;
  expanded: boolean;
  transition: Transition;
  contentTransition: Transition;
  onStopCardToggle: (event: MouseEvent | KeyboardEvent) => void;
}) {
  return (
    <motion.button
      type="button"
      layout
      transition={transition}
      onClick={onStopCardToggle}
      className={
        expanded
          ? "group/avatar relative flex items-center gap-2 rounded-full border border-line bg-[rgb(254,254,252)] py-1.5 pl-1.5 pr-4 text-left shadow-[0_5px_14px_rgba(31,31,27,0.04)] outline-none transition-colors hover:bg-[#F8F8F5] focus-visible:ring-4 focus-visible:ring-[#24C35D]/15"
          : index === 0
            ? "group/avatar relative rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#24C35D]/15"
            : "group/avatar relative -ml-2 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#24C35D]/15 sm:-ml-3"
      }
      aria-label={`Assignee: ${assignee.name}`}
    >
      <Avatar
        assignee={assignee}
        index={index}
        expanded={expanded}
        transition={transition}
      />
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.span
            key={`${assignee.name}-name`}
            initial={{ opacity: 0, width: 0, x: -8 }}
            animate={{ opacity: 1, width: "auto", x: 0 }}
            exit={{ opacity: 0, width: 0, x: -8 }}
            transition={contentTransition}
            className="overflow-hidden whitespace-nowrap text-[19px] font-medium text-[#686863]"
          >
            {assignee.name}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <Tooltip label={assignee.name} />
    </motion.button>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-[9px] bg-[#2D2D29] px-2.5 py-1.5 text-[12px] font-semibold text-[rgb(254,254,252)] opacity-0 shadow-[0_10px_24px_rgba(28,28,24,0.18)] transition-[opacity,transform] duration-150 group-hover/avatar:-translate-y-0.5 group-hover/avatar:opacity-100 group-focus-visible/avatar:-translate-y-0.5 group-focus-visible/avatar:opacity-100"
    >
      {label}
    </span>
  );
}

function Avatar({
  assignee,
  index,
  expanded,
  transition,
}: {
  assignee: Assignee;
  index: number;
  expanded: boolean;
  transition: Transition;
}) {
  return (
    <motion.span
      layoutId={`avatar-${assignee.name}`}
      transition={transition}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full ${
        expanded ? "size-10" : "size-9 sm:size-12"
      }`}
      style={{
        backgroundColor: assignee.ring,
        zIndex: expanded ? 1 : assignees.length - index,
      }}
      aria-label={assignee.name}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="23" fill={assignee.ring} />
        <circle cx="24" cy="24" r="18" fill={assignee.wash} />
        <path
          d="M15 31.5c3.1-3.7 5.8-5.5 9-5.5s5.9 1.8 9 5.5"
          stroke={assignee.ink}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle
          cx="24"
          cy="19"
          r="5.6"
          fill="none"
          stroke={assignee.ink}
          strokeWidth="2.4"
        />
        <text
          x="24"
          y="40"
          textAnchor="middle"
          fill={assignee.ink}
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="7"
          fontWeight="700"
          letterSpacing="0"
        >
          {assignee.initials}
        </text>
      </svg>
    </motion.span>
  );
}

function FlagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 20V5.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.2 5.8h9.1c.7 0 1.1.8.7 1.4l-1.5 2.2 1.5 2.2c.4.6 0 1.4-.7 1.4H7.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 4.5h9M7.5 19.5h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 5.5c0 4.3 7 4.4 7 8.5s-7 4.2-7 8.5M15.5 5.5c0 4.3-7 4.4-7 8.5s7 4.2 7 8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M10.1 17.7h3.8L12 15.9l-1.9 1.8Z" fill="currentColor" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="24" height="8" viewBox="0 0 24 8" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="1.8" fill="currentColor" />
      <circle cx="12" cy="4" r="1.8" fill="currentColor" />
      <circle cx="20" cy="4" r="1.8" fill="currentColor" />
    </svg>
  );
}

function CheckMiniIcon() {
  return (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="none" aria-hidden="true">
      <path
        d="m1.5 5 3.1 3.1 6.9-6.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="17" height="13" viewBox="0 0 17 13" fill="none" aria-hidden="true">
      <path
        d="m2 6.7 3.9 3.8L15 2"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="m3.2 5.2 3.8 3.7 3.8-3.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
