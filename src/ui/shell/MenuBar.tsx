import { Menubar } from "@base-ui/react/menubar"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { MenuIcon } from "lucide-react"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMenus, type MenuEntry } from "../commands"

function Entries({ items }: { items: MenuEntry[] }) {
  return (
    <>
      {items.map((entry, index) => {
        if (entry.type === "separator") return <DropdownMenuSeparator key={`sep-${index}`} />
        if (entry.type === "submenu") {
          return (
            <DropdownMenuSub key={entry.id}>
              <DropdownMenuSubTrigger className="pl-7">{entry.label}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-48">
                <Entries items={entry.items} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }
        if (entry.type === "radio") {
          return (
            <MenuPrimitive.Group key={entry.id}>
              <DropdownMenuLabel>{entry.label}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={entry.value} onValueChange={(value) => entry.onChange(String(value))}>
                {entry.options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} className="pl-2">
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </MenuPrimitive.Group>
          )
        }
        if (entry.checked !== undefined) {
          return (
            <DropdownMenuCheckboxItem key={entry.id} checked={entry.checked} disabled={entry.disabled} onClick={() => entry.run()} closeOnClick className="pr-2 pl-7 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:left-2 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:right-auto">
              <span className="truncate">{entry.label}</span>
              {entry.shortcut ? <DropdownMenuShortcut className="pl-6">{entry.shortcut}</DropdownMenuShortcut> : null}
            </DropdownMenuCheckboxItem>
          )
        }
        return (
          <DropdownMenuItem key={entry.id} disabled={entry.disabled} variant={entry.destructive ? "destructive" : "default"} onClick={() => entry.run()} className="pl-7">
            <span className="max-w-72 truncate">{entry.label}</span>
            {entry.shortcut ? <DropdownMenuShortcut className="pl-6">{entry.shortcut}</DropdownMenuShortcut> : null}
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

/** Desktop menubar: arrow keys move between menus, Escape returns focus to the trigger. */
export function MenuBar({ className }: { className?: string }) {
  const menus = useMenus()
  return (
    <Menubar className={cn("flex items-center gap-0.5", className)} aria-label="Menú principal">
      {menus.map((menu) => (
        <DropdownMenu key={menu.id}>
          <DropdownMenuTrigger className="h-8 rounded-md px-2.5 text-sm text-foreground/85 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent">
            {menu.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-60" sideOffset={6}>
            <Entries items={menu.items} />
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </Menubar>
  )
}

/** Compact menu for narrow screens: the same menus as submenus, in the same order. */
export function CompactMenu() {
  const menus = useMenus()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Menú" />}>
        <MenuIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-56" sideOffset={6}>
        {menus.map((menu) => (
          <DropdownMenuSub key={menu.id}>
            <DropdownMenuSubTrigger className="py-2">{menu.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-56 max-w-[calc(100vw-2rem)]">
              <Entries items={menu.items} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
